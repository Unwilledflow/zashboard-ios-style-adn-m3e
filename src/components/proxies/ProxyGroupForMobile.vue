<template>
  <div
    class="group relative h-22 cursor-pointer"
    :data-group-name="proxyGroup.name"
    ref="cardWrapperRef"
    @click="handlerCardClick"
    v-bind="longPressBindings"
  >
    <div
      v-if="modalMode"
      class="mobile-proxy-modal-backdrop glass-backdrop fixed inset-0 z-40 overflow-hidden"
    />
    <div
      class="mobile-proxy-modal-panel base-container glass-panel absolute flex flex-col overflow-hidden"
      :style="cardStyle"
      @contextmenu.prevent.stop="handlerLatencyTest"
    >
      <div class="relative flex h-22 shrink-0 flex-col justify-between p-2">
        <div
          class="text-md truncate"
          :class="proxyGroup.icon && 'pr-10'"
        >
          {{ proxyGroup.name }}
        </div>
        <div
          class="text-base-content/60 flex min-w-0 items-center gap-2 truncate text-xs"
          :class="proxyGroup.icon && 'pr-12'"
        >
          <span class="shrink-0 whitespace-nowrap">{{ proxyGroup.type }} · {{ proxiesCount }}</span>
          <ProxyGroupFilter
            v-if="displayContent"
            class="min-w-0 flex-1"
            :group-name="name"
          />
        </div>
        <div class="flex items-center">
          <div class="flex flex-1 items-center gap-1 truncate">
            <button
              v-if="manageHiddenGroup"
              type="button"
              class="btn btn-circle btn-xs z-10"
              :aria-label="hiddenGroup ? t('showConnection') : t('hideConnection')"
              :title="hiddenGroup ? t('showConnection') : t('hideConnection')"
              @click.stop="handlerGroupToggle"
            >
              <EyeIcon
                v-if="!hiddenGroup"
                class="h-3 w-3"
              />
              <EyeSlashIcon
                v-else
                class="h-3 w-3"
              />
            </button>
            <ProxyGroupNow
              :name="proxyGroup.name"
              :mobile="true"
            />
          </div>
          <LatencyTag
            :class="LATENCY_TAG_CLASS"
            :loading="isLatencyTesting"
            :name="proxyGroup.now"
            :group-name="proxyGroup.name"
            @click.stop="handlerLatencyTest"
          />
        </div>
        <ProxyIcon
          v-if="proxyGroup?.icon"
          :icon="proxyGroup.icon"
          :size="40"
          :margin="0"
          class="absolute top-2 right-2"
        />
      </div>

      <div
        v-if="displayContent"
        class="smooth-scroll-container max-h-108 overflow-y-auto overscroll-contain p-2"
        :class="[PROXIES_PARENT_CLASS]"
        :data-expanded-ready="expandedContentReady ? 'true' : 'false'"
        :style="{
          width: WIDTH_STYLE,
          contain: 'layout style paint',
        }"
      >
        <Component
          :is="groupProxiesByProvider ? ProxiesByProvider : ProxiesContent"
          :name="name"
          :now="proxyGroup.now"
          :render-proxies="renderProxies"
          :nested-scroll-surface="true"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  lockProxiesPageScroll,
  unlockProxiesPageScroll,
  useProxyHiddenGroup,
} from '@/composables/proxies'
import { useProxyGroupLatencyTest } from '@/composables/proxyLatency'
import { useRenderProxyList } from '@/composables/renderProxies'
import { dockTop } from '@/composables/paddingViews'
import { useLongPress } from '@/composables/useIOSGestures'
import { PROXIES_PARENT_CLASS } from '@/helper/utils'
import { proxyMap } from '@/store/proxies'
import { groupProxiesByProvider, manageHiddenGroup } from '@/store/settings'
import { EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'
import { computed, nextTick, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LatencyTag from './LatencyTag.vue'
import ProxiesByProvider from './ProxiesByProvider.vue'
import ProxiesContent from './ProxiesContent.vue'
import ProxyGroupFilter from './ProxyGroupFilter.vue'
import ProxyGroupNow from './ProxyGroupNow.vue'
import ProxyIcon from './ProxyIcon.vue'

const WIDTH_STYLE = 'calc(100vw - 1.5rem)'
const LATENCY_TAG_CLASS = 'bg-base-200/50 hover:bg-base-200 z-10'
const { t } = useI18n()
const props = defineProps<{
  name: string
}>()
const proxyGroup = computed(() => proxyMap.value[props.name])
const allProxies = computed(() => proxyGroup.value.all ?? [])
const displayContent = ref(false)
const { proxiesCount, renderProxies } = useRenderProxyList(allProxies, props.name, displayContent)
const { handlerLatencyTest, isLatencyTesting } = useProxyGroupLatencyTest(() => props.name)

const modalMode = ref(false)
const expandedContentReady = ref(false)

const cardWrapperRef = ref()

const INIT_STYLE = {
  width: '100%',
  maxHeight: '100%',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 1,
  transform: 'translate3d(0, 0, 0) scale(1)',
}
const COLLAPSED_STYLE = {
  width: '100%',
  maxHeight: '100%',
  transform: 'translate3d(0, 0, 0) scale(1)',
  zIndex: 50,
}
const cardStyle = ref<Record<string, string | number>>({
  ...INIT_STYLE,
})
let calcStyleFrame: number | undefined
let suppressClickTimer: ReturnType<typeof setTimeout> | undefined
let isComponentAlive = true
let expandedReadyFrame: number | undefined
let pageScrollLockToken: symbol | undefined
let viewportListenerCleanup: (() => void) | undefined

const setProxiesPageScrollLocked = (locked: boolean) => {
  if (locked) {
    pageScrollLockToken ??= lockProxiesPageScroll()
    return
  }

  unlockProxiesPageScroll(pageScrollLockToken)
  pageScrollLockToken = undefined
}

const clearExpandedReadyFrame = () => {
  if (expandedReadyFrame === undefined) return
  cancelAnimationFrame(expandedReadyFrame)
  expandedReadyFrame = undefined
}

const queueExpandedContentReady = () => {
  clearExpandedReadyFrame()
  expandedContentReady.value = false
  expandedReadyFrame = requestAnimationFrame(() => {
    expandedReadyFrame = requestAnimationFrame(() => {
      expandedReadyFrame = undefined
      if (!isComponentAlive || !modalMode.value || !displayContent.value) return
      expandedContentReady.value = true
    })
  })
}

const getViewportSize = () => {
  const viewport = window.visualViewport

  return {
    height: viewport?.height ?? window.innerHeight,
    width: viewport?.width ?? window.innerWidth,
  }
}

const getExpandedBottomReserve = () => {
  return Math.max(96, dockTop.value + 32)
}

const calcCardStyle = () => {
  if (calcStyleFrame !== undefined) cancelAnimationFrame(calcStyleFrame)
  calcStyleFrame = requestAnimationFrame(() => {
    calcStyleFrame = undefined
    if (!isComponentAlive) return
    if (!cardWrapperRef.value) return

    if (!modalMode.value) {
      cardStyle.value = COLLAPSED_STYLE
      return
    }

    const manyProxies = allProxies.value.length > 4
    const { left, top, bottom } = cardWrapperRef.value.getBoundingClientRect()
    const { height: viewportHeight, width: viewportWidth } = getViewportSize()

    const minSafeArea = viewportHeight * 0.15
    const baseLine = viewportHeight * 0.2
    const maxSafeArea = viewportHeight * 0.3

    const isLeft = left < viewportWidth / 3
    const isTop = (top + bottom) * 0.5 < viewportHeight * (manyProxies ? 0.7 : 0.5)
    const transformOrigin = isLeft
      ? isTop
        ? 'top left'
        : 'bottom left'
      : isTop
        ? 'top right'
        : 'bottom right'
    const positionKeyX = isLeft ? 'left' : 'right'
    const positionKeyY = isTop ? 'top' : 'bottom'

    let transformValueY = 0
    let verticalOffset = 0

    if (isTop) {
      if (top < minSafeArea || (top > maxSafeArea && manyProxies)) {
        transformValueY = baseLine - top
      }
      verticalOffset = top + transformValueY
    } else {
      const minSafeBottom = viewportHeight - minSafeArea
      const maxSafeBottom = viewportHeight - maxSafeArea
      const baseLineBottom = viewportHeight - baseLine

      if (bottom > minSafeBottom || (bottom < maxSafeBottom && manyProxies)) {
        transformValueY = baseLineBottom - bottom
      }
      verticalOffset = viewportHeight - bottom - transformValueY
    }

    const maxHeight = Math.max(160, viewportHeight - verticalOffset - getExpandedBottomReserve())

    cardStyle.value = {
      width: WIDTH_STYLE,
      maxHeight: `${maxHeight}px`,
      transform: `translate3d(0, ${transformValueY}px, 0) scale(1)`,
      transformOrigin,
      zIndex: 50,
      [positionKeyY]: 0,
      [positionKeyX]: 0,
    }
  })
}

const clearViewportListeners = () => {
  viewportListenerCleanup?.()
  viewportListenerCleanup = undefined
}

const attachViewportListeners = () => {
  if (viewportListenerCleanup) return

  const viewport = window.visualViewport
  const handler = () => {
    if (!modalMode.value) return
    calcCardStyle()
  }

  window.addEventListener('resize', handler, { passive: true })
  window.addEventListener('orientationchange', handler, { passive: true })
  viewport?.addEventListener('resize', handler, { passive: true })
  viewport?.addEventListener('scroll', handler, { passive: true })

  viewportListenerCleanup = () => {
    window.removeEventListener('resize', handler)
    window.removeEventListener('orientationchange', handler)
    viewport?.removeEventListener('resize', handler)
    viewport?.removeEventListener('scroll', handler)
  }
}

const settleExpandedState = () => {
  if (!isComponentAlive) return

  if (modalMode.value) {
    if (!displayContent.value) {
      displayContent.value = true
    }
    nextTick(queueExpandedContentReady)
    return
  }

  displayContent.value = false
  expandedContentReady.value = false
  clearExpandedReadyFrame()

  nextTick(() => {
    if (!isComponentAlive || modalMode.value) return
    cardStyle.value = {
      ...INIT_STYLE,
    }
  })
}

const expandGroup = async () => {
  modalMode.value = !modalMode.value
  setProxiesPageScrollLocked(modalMode.value)
  if (modalMode.value) {
    attachViewportListeners()
  } else {
    clearViewportListeners()
  }
  expandedContentReady.value = false
  clearExpandedReadyFrame()

  calcCardStyle()
  settleExpandedState()
}

const handlerCardClick = async () => {
  if (suppressClickAfterLongPress.value) {
    suppressClickAfterLongPress.value = false
    return
  }
  await expandGroup()
}

const suppressClickAfterLongPress = ref(false)

// Long-press now triggers a speed-test directly; no secondary menu. We still
// suppress the synthetic click that follows a long-press so the card doesn't
// also expand into modal mode immediately afterwards.
const longPressBindings = useLongPress({
  duration: 480,
  onLongPress: () => {
    suppressClickAfterLongPress.value = true
    handlerLatencyTest()
    if (suppressClickTimer !== undefined) clearTimeout(suppressClickTimer)
    suppressClickTimer = setTimeout(() => {
      suppressClickAfterLongPress.value = false
      suppressClickTimer = undefined
    }, 350)
  },
})

const { handlerGroupToggle, hiddenGroup } = useProxyHiddenGroup(() => props.name)

onUnmounted(() => {
  isComponentAlive = false
  if (calcStyleFrame !== undefined) cancelAnimationFrame(calcStyleFrame)
  clearExpandedReadyFrame()
  clearViewportListeners()
  if (suppressClickTimer !== undefined) clearTimeout(suppressClickTimer)
  setProxiesPageScrollLocked(false)
})
</script>
