import { proxyGroupLatencyTest } from '@/store/proxies'
import { onBeforeUnmount, ref } from 'vue'

export const useProxyGroupLatencyTest = (getGroupName: () => string) => {
  const isLatencyTesting = ref(false)
  let latencyTestController: AbortController | undefined
  let latencyTestSeq = 0

  const isCurrentLatencyTest = (controller: AbortController, seq: number) => {
    return latencyTestController === controller && latencyTestSeq === seq
  }

  const handlerLatencyTest = async () => {
    if (isLatencyTesting.value) return

    latencyTestController?.abort()
    const controller = new AbortController()
    const seq = ++latencyTestSeq
    latencyTestController = controller
    isLatencyTesting.value = true
    try {
      await proxyGroupLatencyTest(getGroupName(), undefined, controller.signal)
    } catch {
      // Request interceptor surfaces API failures; keep this click handler settled.
    } finally {
      if (isCurrentLatencyTest(controller, seq)) {
        isLatencyTesting.value = false
        latencyTestController = undefined
      }
    }
  }

  onBeforeUnmount(() => {
    latencyTestController?.abort()
    latencyTestSeq += 1
    latencyTestController = undefined
  })

  return {
    handlerLatencyTest,
    isLatencyTesting,
  }
}
