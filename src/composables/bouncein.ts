import { useCurrentElement } from '@vueuse/core'
import type { Ref } from 'vue'

export function useBounceOnVisible(el: Ref<HTMLElement> = useCurrentElement<HTMLElement>()) {
  void el
}
