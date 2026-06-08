import { blockConnectionByIdAPI, disconnectByIdAPI } from '@/api'
import type { Connection } from '@/types'
import { NoSymbolIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { defineComponent, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

export default defineComponent({
  name: 'ConnectionActions',
  props: {
    conn: {
      type: Object as PropType<Connection>,
      required: true,
    },
    blockFirst: Boolean,
  },
  setup(props) {
    const { t } = useI18n()

    const renderDisconnectButton = () => (
      <button
        class="btn btn-circle btn-xs"
        aria-label={t('disconnectConnection')}
        title={t('disconnectConnection')}
        onClick={(event: MouseEvent) => {
          event.stopPropagation()
          void disconnectByIdAPI(props.conn.id).catch(() => {})
        }}
      >
        <XMarkIcon
          class="h-4 w-4"
          aria-hidden="true"
        />
      </button>
    )

    const renderBlockButton = () => (
      <button
        class="btn btn-circle btn-xs"
        aria-label={t('blockConnection')}
        title={t('blockConnection')}
        onClick={(event: MouseEvent) => {
          event.stopPropagation()
          void blockConnectionByIdAPI(props.conn.id).catch(() => {})
        }}
      >
        <NoSymbolIcon
          class="h-4 w-4"
          aria-hidden="true"
        />
      </button>
    )

    return () => {
      const closeButton = renderDisconnectButton()

      if (props.conn.metadata.smartBlock !== 'normal') {
        return closeButton
      }

      const blockButton = renderBlockButton()
      const actions = props.blockFirst ? [blockButton, closeButton] : [closeButton, blockButton]

      return <div class="flex gap-1">{actions}</div>
    }
  },
})
