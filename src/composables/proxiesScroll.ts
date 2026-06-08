import { PROXY_CARD_SIZE } from '@/constant'
import { findScrollableParent } from '@/helper/utils'
import { minProxyCardWidth, proxyCardSize } from '@/store/settings'
import { useCurrentElement, useElementSize, useInfiniteScroll } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

const SCROLL_STABLE_PROXY_LIMIT = 200

export const useCalculateMaxProxies = (
  totalProxies: MaybeRefOrGetter<number>,
  activeIndex: MaybeRefOrGetter<number>,
  enabled: MaybeRefOrGetter<boolean> = true,
) => {
  const el = useCurrentElement()
  const totalProxyCount = computed(() => Math.max(0, toValue(totalProxies)))
  const enabledState = computed(() => toValue(enabled))
  const lazyRenderEnabled = computed(
    () => enabledState.value && totalProxyCount.value > SCROLL_STABLE_PROXY_LIMIT,
  )
  const measuredElement = computed(() =>
    lazyRenderEnabled.value && el.value instanceof HTMLElement ? el.value : null,
  )
  const { width } = useElementSize(measuredElement)
  const activeProxyIndex = computed(() => {
    if (!lazyRenderEnabled.value) return -1

    return Math.max(-1, toValue(activeIndex))
  })
  const initMaxProxies = computed(() => {
    if (totalProxyCount.value <= SCROLL_STABLE_PROXY_LIMIT) {
      return totalProxyCount.value
    }

    return (
      Math.max(Math.floor(width.value / minProxyCardWidth.value), 2) *
      (proxyCardSize.value === PROXY_CARD_SIZE.LARGE ? 9 : 12)
    )
  })
  const maxProxies = ref(Math.min(Math.max(24, activeProxyIndex.value + 12), totalProxyCount.value))
  let infiniteScrollAttached = false

  const setMaxProxies = (nextMaxProxies: number) => {
    if (nextMaxProxies === maxProxies.value) return
    maxProxies.value = nextMaxProxies
  }

  const syncMaxProxies = () => {
    if (!enabledState.value) return
    if (!lazyRenderEnabled.value) {
      setMaxProxies(totalProxyCount.value)
      return
    }

    setMaxProxies(
      Math.min(
        Math.max(maxProxies.value, initMaxProxies.value, activeProxyIndex.value + 12, 24),
        totalProxyCount.value,
      ),
    )
  }

  const attachInfiniteScroll = () => {
    if (infiniteScrollAttached) return
    if (!lazyRenderEnabled.value) return

    const element = measuredElement.value

    if (!element) return

    const scrollEl = findScrollableParent(element)

    if (!scrollEl) return

    infiniteScrollAttached = true
    useInfiniteScroll(
      scrollEl,
      () => {
        if (!lazyRenderEnabled.value) return

        setMaxProxies(
          Math.min(maxProxies.value + Math.max(initMaxProxies.value, 24), totalProxyCount.value),
        )
      },
      {
        distance: 100,
        interval: 120,
        canLoadMore: () => {
          return lazyRenderEnabled.value && maxProxies.value < totalProxyCount.value
        },
      },
    )
  }

  watch([initMaxProxies, totalProxyCount, activeProxyIndex, enabledState], syncMaxProxies, {
    immediate: true,
  })

  watch(lazyRenderEnabled, () => nextTick(attachInfiniteScroll), {
    flush: 'post',
  })

  onMounted(() => {
    nextTick(attachInfiniteScroll)
  })

  return {
    maxProxies,
  }
}
