<script setup lang="ts">
import { handlerProxySelect } from '@/store/proxies'
import {
  activeFolderCanSelectNodes,
  nodeIncludedInActiveFolder,
  toggleNodeInActiveFolder,
} from '@/store/proxyFolders'
import { computed } from 'vue'
import ProxyNodeCard from './ProxyNodeCard.vue'
import ProxyNodeGrid from './ProxyNodeGrid.vue'
import VirtualProxyNodeGrid from './VirtualProxyNodeGrid.vue'

const props = defineProps<{
  name: string
  now?: string
  renderProxies: string[]
  nestedScrollSurface?: boolean
}>()

const isVirtualGrid = computed(() => props.renderProxies.length > 200)
</script>

<template>
  <VirtualProxyNodeGrid
    v-if="isVirtualGrid"
    :name="name"
    :now="now"
    :nodes="renderProxies"
    :node-folder-selectable="activeFolderCanSelectNodes"
  />
  <ProxyNodeGrid
    v-else
    :nested-scroll-surface="nestedScrollSurface"
  >
    <ProxyNodeCard
      v-for="node in renderProxies"
      :key="node"
      :name="node"
      :group-name="name"
      :active="node === now"
      :nested-scroll-surface="nestedScrollSurface"
      :node-folder-selectable="activeFolderCanSelectNodes"
      :node-folder-active="nodeIncludedInActiveFolder(name, node)"
      @click.stop="handlerProxySelect(name, node)"
      @toggle-node-folder="toggleNodeInActiveFolder(name, node)"
    />
  </ProxyNodeGrid>
</template>
