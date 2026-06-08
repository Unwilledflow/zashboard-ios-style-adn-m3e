import { FOLDER_MODE, FOLDER_MODE_AUTO_THRESHOLD } from '@/constant'
import { proxyGroupList, proxyMap } from '@/store/proxies'
import { proxyFolderMode } from '@/store/settings'
import { useStorage } from '@vueuse/core'
import { v4 as uuid } from 'uuid'
import { computed, watch } from 'vue'

export const VIRTUAL_ALL = '__all__'
export const VIRTUAL_UNCAT = '__uncat__'

export const BUILTIN_STRATEGY_ID = 'builtin-strategy'
export const BUILTIN_NODES_ID = 'builtin-nodes'

export type FolderRule =
  | { type: 'auto'; value: 'nodeOnly' | 'hasGroup' }
  | { type: 'regex'; pattern: string }
  | { type: 'excludeRegex'; pattern: string }

export interface Folder {
  id: string
  name: string
  icon?: string
  order: number
  rules: FolderRule[]
  manualIncludes: string[]
  manualNodeIncludes?: Record<string, string[]>
}

interface FolderState {
  folders: Folder[]
  activeId: string
  seeded: boolean
}

const defaultState = (): FolderState => ({
  folders: [],
  activeId: VIRTUAL_ALL,
  seeded: false,
})

export const folderState = useStorage<FolderState>(
  'config/proxy-folders',
  defaultState(),
  localStorage,
  {
    mergeDefaults: true,
  },
)

const seedDefaultFolders = () => {
  if (folderState.value.seeded) return
  folderState.value.folders = [
    {
      id: BUILTIN_STRATEGY_ID,
      name: 'folder_builtin_strategy',
      order: 0,
      rules: [{ type: 'auto', value: 'hasGroup' }],
      manualIncludes: [],
      manualNodeIncludes: {},
    },
    {
      id: BUILTIN_NODES_ID,
      name: 'folder_builtin_nodes',
      order: 1,
      rules: [{ type: 'auto', value: 'nodeOnly' }],
      manualIncludes: [],
      manualNodeIncludes: {},
    },
  ]
  folderState.value.seeded = true
}

seedDefaultFolders()

export const folders = computed({
  get: () => folderState.value.folders,
  set: (v) => {
    folderState.value.folders = v
  },
})

export const activeFolderId = computed({
  get: () => folderState.value.activeId,
  set: (v) => {
    folderState.value.activeId = v
  },
})

const isNodeOnly = (groupName: string) => {
  const g = proxyMap.value[groupName]
  if (!g?.all || g.all.length === 0) return false
  const groupSet = new Set(proxyGroupList.value)
  return !g.all.some((member) => groupSet.has(member))
}

const matchRule = (groupName: string, rule: FolderRule): boolean => {
  if (rule.type === 'auto') {
    return rule.value === 'nodeOnly' ? isNodeOnly(groupName) : !isNodeOnly(groupName)
  }
  if (rule.type === 'regex' || rule.type === 'excludeRegex') {
    if (!rule.pattern) return false
    try {
      return new RegExp(rule.pattern).test(groupName)
    } catch {
      return false
    }
  }
  return false
}

const folderRuleMatch = (groupName: string, rules: FolderRule[]): boolean => {
  const includes = rules.filter((r) => r.type === 'auto' || r.type === 'regex')
  const excludes = rules.filter((r) => r.type === 'excludeRegex')
  if (!includes.some((r) => matchRule(groupName, r))) return false
  return !excludes.some((r) => matchRule(groupName, r))
}

const manualNodeIncludesFor = (folder: Folder) => folder.manualNodeIncludes ?? {}

const folderHasManualNodesForGroup = (folder: Folder, groupName: string) => {
  return (manualNodeIncludesFor(folder)[groupName]?.length ?? 0) > 0
}

const folderFullyIncludesGroup = (folder: Folder, groupName: string) => {
  return folder.manualIncludes.includes(groupName) || folderRuleMatch(groupName, folder.rules)
}

const arraysEqual = (a: string[], b: string[]) => {
  return a.length === b.length && a.every((item, index) => item === b[index])
}

const pruneManualEntriesForCurrentProxyMap = () => {
  if (!proxyGroupList.value.length) return

  const groupSet = new Set(proxyGroupList.value)
  let changed = false
  const nextFolders = folderState.value.folders.map((folder) => {
    const manualIncludes = folder.manualIncludes.filter((groupName) => groupSet.has(groupName))
    const manualNodeIncludes: Record<string, string[]> = {}
    let nodeIncludesChanged = false

    for (const [groupName, nodes] of Object.entries(manualNodeIncludesFor(folder))) {
      if (!groupSet.has(groupName)) {
        nodeIncludesChanged = true
        continue
      }

      const groupNodes = new Set(proxyMap.value[groupName]?.all ?? [])
      const seen = new Set<string>()
      const validNodes = nodes.filter((nodeName) => {
        if (seen.has(nodeName) || !groupNodes.has(nodeName)) return false
        seen.add(nodeName)
        return true
      })

      if (!arraysEqual(validNodes, nodes)) {
        nodeIncludesChanged = true
      }
      if (validNodes.length) {
        manualNodeIncludes[groupName] = validNodes
      }
    }

    const manualIncludesChanged = !arraysEqual(manualIncludes, folder.manualIncludes)
    if (!manualIncludesChanged && !nodeIncludesChanged) return folder

    changed = true
    return {
      ...folder,
      manualIncludes,
      manualNodeIncludes,
    }
  })

  if (changed) {
    folderState.value.folders = nextFolders
  }
}

const sortedFolders = computed(() =>
  [...folderState.value.folders].sort((a, b) => a.order - b.order),
)

export const groupMatchesFolderRule = (groupName: string, folderId: string): boolean => {
  const f = folderState.value.folders.find((x) => x.id === folderId)
  if (!f) return false
  return folderRuleMatch(groupName, f.rules)
}

export const foldersOfGroup = (groupName: string): string[] => {
  const result: string[] = []
  for (const f of sortedFolders.value) {
    if (folderFullyIncludesGroup(f, groupName) || folderHasManualNodesForGroup(f, groupName)) {
      result.push(f.id)
    }
  }
  return result
}

export const groupsByFolder = computed(() => {
  const map = new Map<string, string[]>()
  for (const name of proxyGroupList.value) {
    const ids = foldersOfGroup(name)
    if (ids.length === 0) {
      const list = map.get(VIRTUAL_UNCAT) ?? []
      list.push(name)
      map.set(VIRTUAL_UNCAT, list)
      continue
    }
    for (const id of ids) {
      const list = map.get(id) ?? []
      list.push(name)
      map.set(id, list)
    }
  }
  return map
})

export const groupsInActiveFolder = computed<Set<string> | null>(() => {
  const id = folderState.value.activeId
  if (id === VIRTUAL_ALL) return null
  const list = groupsByFolder.value.get(id) ?? []
  return new Set(list)
})

export const folderCount = (id: string) => groupsByFolder.value.get(id)?.length ?? 0

export const isProxyFolderModeActive = computed(() => {
  switch (proxyFolderMode.value) {
    case FOLDER_MODE.ON:
      return true
    case FOLDER_MODE.OFF:
      return false
    default:
      return proxyGroupList.value.length > FOLDER_MODE_AUTO_THRESHOLD
  }
})

export const isCustomFolder = (folderId: string) => {
  return ![VIRTUAL_ALL, VIRTUAL_UNCAT, BUILTIN_STRATEGY_ID, BUILTIN_NODES_ID].includes(folderId)
}

watch(
  proxyGroupList,
  (list) => {
    if (!list.length) return
    pruneManualEntriesForCurrentProxyMap()
    const id = folderState.value.activeId
    if (id === VIRTUAL_ALL || id === VIRTUAL_UNCAT) return
    if (!folderState.value.folders.some((f) => f.id === id)) {
      folderState.value.activeId = VIRTUAL_ALL
    }
  },
  { immediate: true },
)

export const createFolder = (name: string): Folder => {
  const folder: Folder = {
    id: uuid(),
    name,
    order: folderState.value.folders.length,
    rules: [],
    manualIncludes: [],
    manualNodeIncludes: {},
  }
  folderState.value.folders.push(folder)
  return folder
}

export const removeFolder = (id: string) => {
  if (!isCustomFolder(id)) return
  folderState.value.folders = folderState.value.folders.filter((f) => f.id !== id)
  if (folderState.value.activeId === id) folderState.value.activeId = VIRTUAL_ALL
}

export const updateFolder = (id: string, patch: Partial<Omit<Folder, 'id'>>) => {
  const f = folderState.value.folders.find((x) => x.id === id)
  if (!f) return
  Object.assign(f, patch)
}

export const reorderFolders = (ids: string[]) => {
  const map = new Map(folderState.value.folders.map((f) => [f.id, f]))
  const next: Folder[] = []
  ids.forEach((id, idx) => {
    const f = map.get(id)
    if (f) {
      f.order = idx
      next.push(f)
      map.delete(id)
    }
  })
  for (const f of map.values()) {
    f.order = next.length
    next.push(f)
  }
  folderState.value.folders = next
}

export const addGroupToFolder = (groupName: string, folderId: string) => {
  const f = folderState.value.folders.find((x) => x.id === folderId)
  if (!f) return
  if (!f.manualIncludes.includes(groupName)) f.manualIncludes.push(groupName)
}

export const removeManualInclude = (groupName: string, folderId: string) => {
  const f = folderState.value.folders.find((x) => x.id === folderId)
  if (!f) return
  f.manualIncludes = f.manualIncludes.filter((n) => n !== groupName)
}

export const activeFolderCanSelectNodes = computed(() => {
  return isCustomFolder(folderState.value.activeId)
})

const activeFolderNodeFiltersByGroup = computed(() => {
  const f = folderState.value.folders.find((x) => x.id === folderState.value.activeId)
  const filters = new Map<string, Set<string>>()
  if (!f) return filters

  for (const [groupName, nodes] of Object.entries(manualNodeIncludesFor(f))) {
    if (!nodes.length || folderFullyIncludesGroup(f, groupName)) continue
    filters.set(groupName, new Set(nodes))
  }

  return filters
})

export const nodeIncludedInFolder = (groupName: string, nodeName: string, folderId: string) => {
  const f = folderState.value.folders.find((x) => x.id === folderId)
  if (!f) return false
  return manualNodeIncludesFor(f)[groupName]?.includes(nodeName) ?? false
}

export const nodeIncludedInActiveFolder = (groupName: string, nodeName: string) => {
  return nodeIncludedInFolder(groupName, nodeName, folderState.value.activeId)
}

export const addNodeToFolder = (groupName: string, nodeName: string, folderId: string) => {
  const f = folderState.value.folders.find((x) => x.id === folderId)
  if (!f) return

  const manualNodeIncludes = { ...manualNodeIncludesFor(f) }
  const nodes = manualNodeIncludes[groupName] ?? []
  if (nodes.includes(nodeName)) return

  manualNodeIncludes[groupName] = [...nodes, nodeName]
  updateFolder(folderId, { manualNodeIncludes })
}

export const removeNodeFromFolder = (groupName: string, nodeName: string, folderId: string) => {
  const f = folderState.value.folders.find((x) => x.id === folderId)
  if (!f) return

  const manualNodeIncludes = { ...manualNodeIncludesFor(f) }
  const nodes = (manualNodeIncludes[groupName] ?? []).filter((n) => n !== nodeName)

  if (nodes.length) {
    manualNodeIncludes[groupName] = nodes
  } else {
    delete manualNodeIncludes[groupName]
  }

  updateFolder(folderId, { manualNodeIncludes })
}

export const toggleNodeInActiveFolder = (groupName: string, nodeName: string) => {
  const folderId = folderState.value.activeId
  if (!isCustomFolder(folderId)) return

  if (nodeIncludedInFolder(groupName, nodeName, folderId)) {
    removeNodeFromFolder(groupName, nodeName, folderId)
  } else {
    addNodeToFolder(groupName, nodeName, folderId)
  }
}

export const activeFolderNodeFilterForGroup = (groupName: string): Set<string> | null => {
  return activeFolderNodeFiltersByGroup.value.get(groupName) ?? null
}

export const folderManagerOpen = useStorage('cache/folder-manager-open', false, sessionStorage)
