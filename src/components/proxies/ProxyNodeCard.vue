<template>
  <div
    ref="cardRef"
    :class="cardClass"
    @contextmenu.stop.prevent="handlerLatencyTest"
  >
    <button
      v-if="nodeFolderSelectable"
      type="button"
      class="node-folder-toggle"
      :class="nodeFolderActive ? 'is-active' : ''"
      :aria-label="nodeFolderActive ? t('folder_remove_node') : t('folder_add_node')"
      :title="nodeFolderActive ? t('folder_remove_node') : t('folder_add_node')"
      @click.stop="$emit('toggleNodeFolder')"
    >
      <CheckCircleIcon
        v-if="nodeFolderActive"
        class="h-3.5 w-3.5"
        aria-hidden="true"
      />
      <PlusCircleIcon
        v-else
        class="h-3.5 w-3.5"
        aria-hidden="true"
      />
    </button>
    <div
      class="w-full flex-1 text-sm"
      :class="[truncateProxyName && 'truncate', nodeFolderSelectable && 'pr-6']"
      @mouseenter="checkTruncation"
    >
      <ProxyIcon
        v-if="node?.icon"
        class="-mt-[2px] shrink-0 align-middle"
        :icon="node.icon"
        :fill="active ? 'fill-primary-content' : 'fill-base-content'"
      /><span
        v-if="active"
        class="text-primary-content"
        >{{ node.name }}</span
      ><span
        v-else
        class="text-base-content"
        >{{ node.name }}</span
      >
    </div>

    <div class="flex h-4 w-full items-center justify-between">
      <span
        :class="typeDescriptionClass"
        @mouseenter="checkTruncation"
      >
        {{ typeDescription }}
      </span>
      <LatencyTag
        :class="latencyTagClass"
        :name="node.name"
        :loading="isLatencyTesting"
        :group-name="groupName"
        @click.stop="handlerLatencyTest"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { PROXY_CARD_SIZE, PROXY_SORT_TYPE } from '@/constant'
import { checkTruncation } from '@/helper/tooltip'
import { scrollIntoCenter } from '@/helper/utils'
import { i18n } from '@/i18n'
import { getIPv6ByName, getTestUrl, proxyLatencyTest, proxyMap } from '@/store/proxies'
import { IPv6test, proxyCardSize, proxySortType, truncateProxyName } from '@/store/settings'
import { smartWeightsMap } from '@/store/smart'
import { CheckCircleIcon, PlusCircleIcon } from '@heroicons/vue/24/outline'
import { computed, onBeforeUnmount, onUnmounted, ref, watch } from 'vue'
import LatencyTag from './LatencyTag.vue'
import ProxyIcon from './ProxyIcon.vue'

const t = i18n.global.t
const props = defineProps<{
  name: string
  active?: boolean
  groupName?: string
  autoScrollActive?: boolean
  nestedScrollSurface?: boolean
  nodeFolderSelectable?: boolean
  nodeFolderActive?: boolean
}>()
defineEmits<{ (e: 'toggleNodeFolder'): void }>()

const formattedProxyTypeCache = new Map<string, string>()
const BASE_CARD_CLASS =
  'group relative flex cursor-pointer flex-col items-start rounded-2xl border border-transparent'
const DEFAULT_INTERACTION_CLASS = 'active:scale-[0.98]'
const ACTIVE_DEFAULT_CARD_CLASS =
  'bg-primary text-primary-content shadow-ios-card sm:hover:bg-primary/95'
const ACTIVE_NESTED_CARD_CLASS = 'bg-primary text-primary-content'
const NESTED_CARD_CLASS = 'bg-base-200/80'
const DEFAULT_CARD_CLASS = 'glass-surface hover:border-base-content/10 sm:hover:bg-base-200'
const NESTED_TRANSITION_CLASS = ''
const DEFAULT_TRANSITION_CLASS =
  'transition-[background-color,transform,box-shadow,border-color] duration-200 ease-out'
const SMALL_CARD_CLASS = 'gap-1 p-2'
const LARGE_CARD_CLASS = 'gap-2 p-3'
const cardRef = ref()
const node = computed(() => proxyMap.value[props.name])
const isLatencyTesting = ref(false)
const typeFormatter = (type: string) => {
  const cached = formattedProxyTypeCache.get(type)
  if (cached !== undefined) return cached

  const formatted = type
    .toLowerCase()
    .replace('shadowsocks', 'ss')
    .replace('hysteria', 'hy')
    .replace('wireguard', 'wg')

  formattedProxyTypeCache.set(type, formatted)
  return formatted
}
const isSmallCard = computed(() => proxyCardSize.value === PROXY_CARD_SIZE.SMALL)
const useCompactCard = computed(() => props.nestedScrollSurface || isSmallCard.value)
const cardClass = computed(() => [
  BASE_CARD_CLASS,
  props.nestedScrollSurface ? '' : DEFAULT_INTERACTION_CLASS,
  props.active
    ? props.nestedScrollSurface
      ? ACTIVE_NESTED_CARD_CLASS
      : ACTIVE_DEFAULT_CARD_CLASS
    : props.nestedScrollSurface
      ? NESTED_CARD_CLASS
      : DEFAULT_CARD_CLASS,
  props.nestedScrollSurface ? NESTED_TRANSITION_CLASS : DEFAULT_TRANSITION_CLASS,
  useCompactCard.value ? SMALL_CARD_CLASS : LARGE_CARD_CLASS,
  latencyTipAnimationClass.value,
])
const typeDescriptionClass = computed(() =>
  props.active
    ? 'truncate text-xs tracking-tight text-primary-content'
    : 'truncate text-xs tracking-tight text-base-content/60',
)
const latencyTagClass = computed(() =>
  useCompactCard.value ? ['h-4! w-8! rounded-md!', 'shrink-0'] : ['shrink-0'],
)
const typeDescription = computed(() => {
  const type = typeFormatter(node.value.type)
  const smartUsage = smartWeightsMap.value[props.groupName ?? '']?.[props.name]
  const smartDesc = smartUsage ? t(smartUsage) : ''
  const isV6 = IPv6test.value && getIPv6ByName(node.value.name) ? 'IPv6' : ''
  const isUDP = node.value.udp ? (node.value.xudp ? 'xudp' : 'udp') : ''
  const separator = isSmallCard.value ? '/' : ' / '
  let description = type

  if (isUDP) description += `${separator}${isUDP}`
  if (smartDesc) description += `${separator}${smartDesc}`
  if (isV6) description += `${separator}${isV6}`

  return description
})

const latencyTipAnimationClass = ref<string[]>([])
let latencyTipTimer: ReturnType<typeof setTimeout> | undefined
let initialScrollTimer: ReturnType<typeof setTimeout> | undefined
let latencyTestController: AbortController | undefined
let latencyTestSeq = 0

const isCurrentLatencyTest = (controller: AbortController, seq: number) => {
  return latencyTestController === controller && latencyTestSeq === seq
}

const clearInitialScrollTimer = () => {
  if (initialScrollTimer === undefined) return
  clearTimeout(initialScrollTimer)
  initialScrollTimer = undefined
}

const queueInitialScroll = () => {
  clearInitialScrollTimer()
  if (props.autoScrollActive === false) return

  initialScrollTimer = setTimeout(() => {
    initialScrollTimer = undefined
    if (!cardRef.value || !props.active || props.autoScrollActive === false) return
    scrollIntoCenter(cardRef.value, 'auto')
  }, 300)
}

const handlerLatencyTest = async () => {
  if (isLatencyTesting.value) return

  latencyTestController?.abort()
  const controller = new AbortController()
  const seq = ++latencyTestSeq
  let testSettled = false
  latencyTestController = controller
  isLatencyTesting.value = true
  try {
    await proxyLatencyTest(props.name, getTestUrl(props.groupName), undefined, controller.signal)
    testSettled = true
  } catch {
    if (controller.signal.aborted) return
    // Request interceptor surfaces API failures; avoid success-only scroll feedback.
  } finally {
    if (isCurrentLatencyTest(controller, seq)) {
      isLatencyTesting.value = false
    }
  }

  const isCurrent = isCurrentLatencyTest(controller, seq)

  if (
    isCurrent &&
    testSettled &&
    [PROXY_SORT_TYPE.LATENCY_ASC, PROXY_SORT_TYPE.LATENCY_DESC].includes(proxySortType.value) &&
    cardRef.value
  ) {
    const classList = ['bg-info/20!', 'transition-colors', 'duration-1500']

    scrollIntoCenter(cardRef.value)
    latencyTipAnimationClass.value = classList
    if (latencyTipTimer !== undefined) clearTimeout(latencyTipTimer)
    latencyTipTimer = setTimeout(() => {
      latencyTipAnimationClass.value = []
      latencyTipTimer = undefined
    }, 1500)
  }

  if (isCurrentLatencyTest(controller, seq)) {
    latencyTestController = undefined
  }
}

watch(
  () => props.active,
  (active) => {
    if (active) {
      queueInitialScroll()
    } else {
      clearInitialScrollTimer()
    }
  },
  { immediate: true, flush: 'post' },
)

onUnmounted(() => {
  if (latencyTipTimer !== undefined) clearTimeout(latencyTipTimer)
  clearInitialScrollTimer()
})

onBeforeUnmount(() => {
  latencyTestController?.abort()
  latencyTestSeq += 1
  latencyTestController = undefined
})
</script>

<style scoped>
.node-folder-toggle {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-base-100) 82%, transparent);
  color: color-mix(in srgb, var(--color-base-content) 52%, transparent);
  box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--color-base-content) 10%, transparent);
  transition:
    background-color 0.18s var(--ios-ease),
    color 0.18s var(--ios-ease),
    transform 0.16s var(--ios-spring);
}

.node-folder-toggle:active {
  transform: scale(0.92);
}

.node-folder-toggle.is-active {
  background: color-mix(in srgb, var(--color-primary) 18%, transparent);
  color: var(--color-primary);
}

.tooltip:before {
  z-index: 20;
}
</style>
