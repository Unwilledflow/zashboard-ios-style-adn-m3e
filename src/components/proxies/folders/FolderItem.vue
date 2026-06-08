<template>
  <button
    type="button"
    class="proxy-folder-pill group"
    :class="[
      orientation === 'horizontal' ? 'shrink-0' : 'w-full text-left',
      isActive ? 'is-active' : '',
    ]"
    :aria-label="accessibleLabel"
    @click="$emit('activate')"
  >
    <component
      v-if="iconComponent"
      :is="iconComponent"
      class="proxy-folder-pill__icon"
      aria-hidden="true"
    />
    <span class="proxy-folder-pill__label">{{ label }}</span>
    <span
      v-if="count !== undefined"
      class="proxy-folder-pill__count"
    >
      {{ count }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { FolderIcon, FolderOpenIcon, InboxIcon, Squares2X2Icon } from '@heroicons/vue/24/outline'
import { computed } from 'vue'

const props = defineProps<{
  id: string
  label: string
  count?: number
  isActive?: boolean
  orientation?: 'vertical' | 'horizontal'
  icon?: 'all' | 'folder' | 'uncategorized'
}>()

defineEmits<{ (e: 'activate'): void }>()

const iconComponent = computed(() => {
  if (props.icon === 'all') return Squares2X2Icon
  if (props.icon === 'uncategorized') return InboxIcon
  if (props.icon === 'folder') return props.isActive ? FolderOpenIcon : FolderIcon
  return null
})

const accessibleLabel = computed(() =>
  props.count === undefined ? props.label : `${props.label} ${props.count}`,
)
</script>
