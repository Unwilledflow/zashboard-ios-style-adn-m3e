<template>
  <div
    class="grid min-w-0"
    :class="nestedScrollSurface ? 'gap-1' : 'gap-2'"
    :style="gridStyle"
  >
    <slot />
  </div>
</template>

<script lang="ts" setup>
import { minProxyCardWidth } from '@/store/settings'
import { computed } from 'vue'

const props = defineProps<{
  nestedScrollSurface?: boolean
}>()

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(auto-fill, minmax(min(${minProxyCardWidth.value}px, 100%), 1fr))`,
  ...(props.nestedScrollSurface ? { contain: 'layout style paint' } : {}),
}))
</script>
