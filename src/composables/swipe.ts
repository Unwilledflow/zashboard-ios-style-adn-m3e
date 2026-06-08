import { CONNECTION_TAB_TYPE, PROXY_TAB_TYPE, ROUTE_NAME, RULE_TAB_TYPE } from '@/constant'
import { renderRoutes } from '@/helper'
import { connectionTabShow } from '@/store/connections'
import { proxiesTabShow, proxyProviederList } from '@/store/proxies'
import { ruleProviderList, rulesTabShow } from '@/store/rules'
import { swipeInPages, swipeInTabs } from '@/store/settings'
import { useSwipe } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export const disableSwipe = ref(false)

type SwipeItem = [isActive: () => boolean, activate: () => void]
type RouteSwipeDirection = 'left' | 'right'

const SWIPE_START_THRESHOLD = 10
const HORIZONTAL_LOCK_RATIO = 1.35
const MIN_COMMIT_DISTANCE = 56
const MAX_COMMIT_DISTANCE = 96
const COMMIT_VIEWPORT_RATIO = 0.18

export const useSwipeRouter = () => {
  const swiperRef = ref<HTMLElement>()
  const route = useRoute()
  const router = useRouter()
  const swipeStartAllowed = ref(false)

  const swipeList = computed<SwipeItem[]>(() => {
    return renderRoutes.value.flatMap((r) => {
      if (swipeInTabs.value) {
        if (r === ROUTE_NAME.proxies && proxyProviederList.value.length > 0) {
          return Object.values(PROXY_TAB_TYPE).map<SwipeItem>((tab) => {
            return [
              () => route.name === ROUTE_NAME.proxies && proxiesTabShow.value === tab,
              () => {
                if (route.name !== ROUTE_NAME.proxies) {
                  void router.push({ name: ROUTE_NAME.proxies, replace: true })
                }
                proxiesTabShow.value = tab
              },
            ]
          })
        } else if (r === ROUTE_NAME.connections) {
          return Object.values(CONNECTION_TAB_TYPE).map<SwipeItem>((tab) => {
            return [
              () => route.name === ROUTE_NAME.connections && connectionTabShow.value === tab,
              () => {
                if (route.name !== ROUTE_NAME.connections) {
                  void router.push({ name: ROUTE_NAME.connections, replace: true })
                }
                connectionTabShow.value = tab
              },
            ]
          })
        } else if (r === ROUTE_NAME.rules && ruleProviderList.value.length > 0) {
          return Object.values(RULE_TAB_TYPE).map<SwipeItem>((tab) => {
            return [
              () => route.name === ROUTE_NAME.rules && rulesTabShow.value === tab,
              () => {
                if (route.name !== ROUTE_NAME.rules) {
                  void router.push({ name: ROUTE_NAME.rules, replace: true })
                }
                rulesTabShow.value = tab
              },
            ]
          })
        }
      }

      return [[() => route.name === r, () => void router.push({ name: r, replace: true })]]
    })
  })

  const getCurrentIndexInSwipeList = () => {
    return swipeList.value.findIndex((s) => s[0]())
  }

  const activateSwipeItem = (offset: 1 | -1) => {
    const routeName = route.name as ROUTE_NAME

    if (routeName === ROUTE_NAME.setup) {
      void router.push({ name: ROUTE_NAME.proxies, replace: true })
      return
    }

    const currentIndex = getCurrentIndexInSwipeList()
    if (!swipeList.value.length || currentIndex < 0) return

    swipeList.value[
      (currentIndex + offset + swipeList.value.length) % swipeList.value.length
    ]?.[1]?.()
  }

  const isInputActive = () => {
    const activeEl = document.activeElement
    return activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')
  }

  const canHandleSwipe = () => {
    if (!swipeInPages.value) return

    if (
      document.querySelector('dialog:modal') ||
      isInputActive() ||
      window.getSelection()?.toString()?.length ||
      disableSwipe.value
    )
      return

    return true
  }

  const getCommitDistance = () => {
    const viewportWidth = swiperRef.value?.clientWidth || window.innerWidth || MIN_COMMIT_DISTANCE
    return Math.min(
      MAX_COMMIT_DISTANCE,
      Math.max(MIN_COMMIT_DISTANCE, viewportWidth * COMMIT_VIEWPORT_RATIO),
    )
  }

  const isHorizontalIntent = computed(() => {
    const horizontalDistance = Math.abs(lengthX.value)
    const verticalDistance = Math.abs(lengthY.value)
    return (
      horizontalDistance >= SWIPE_START_THRESHOLD &&
      horizontalDistance > verticalDistance * HORIZONTAL_LOCK_RATIO
    )
  })

  const isHorizontalSwipe = () => {
    const horizontalDistance = Math.abs(lengthX.value)
    const verticalDistance = Math.abs(lengthY.value)
    return (
      horizontalDistance >= getCommitDistance() &&
      horizontalDistance > verticalDistance * HORIZONTAL_LOCK_RATIO
    )
  }

  const getSwipeDirection = (): RouteSwipeDirection => {
    return lengthX.value > 0 ? 'left' : 'right'
  }

  const { isSwiping, lengthX, lengthY } = useSwipe(swiperRef, {
    threshold: SWIPE_START_THRESHOLD,
    passive: true,
    onSwipeStart() {
      swipeStartAllowed.value = !!canHandleSwipe()
    },
    onSwipeEnd(event) {
      if (event.type === 'touchcancel') {
        swipeStartAllowed.value = false
        return
      }

      const shouldCommit = swipeStartAllowed.value && canHandleSwipe() && isHorizontalSwipe()
      swipeStartAllowed.value = false

      if (!shouldCommit) return

      if (getSwipeDirection() === 'right') {
        activateSwipeItem(-1)
      } else {
        activateSwipeItem(1)
      }
    },
  })

  const isDragging = computed(() => {
    return swipeStartAllowed.value && isSwiping.value && isHorizontalIntent.value
  })

  return {
    isDragging,
    swiperRef,
  }
}
