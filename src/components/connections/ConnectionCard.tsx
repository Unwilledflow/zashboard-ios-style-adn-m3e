import { useConnections } from '@/composables/connections'
import {
  CONNECTION_TAB_TYPE,
  CONNECTIONS_TABLE_ACCESSOR_KEY,
  PROXY_CHAIN_DIRECTION,
} from '@/constant'
import { getConnectionDisplayValue, getConnectionRenderedChains } from '@/helper/connection'
import {
  connectionFilter,
  connectionTabShow,
  getConnectionCachedDisplayValue,
} from '@/store/connections'
import { connectionCardLines, proxyChainDirection, showFullProxyChain } from '@/store/settings'
import type { Connection } from '@/types'
import {
  ArrowDownCircleIcon,
  ArrowDownIcon,
  ArrowRightCircleIcon,
  ArrowUpCircleIcon,
  ArrowUpIcon,
} from '@heroicons/vue/24/outline'
import { defineComponent } from 'vue'
import type { JSX } from 'vue/jsx-runtime'
import HighlightText from '../common/HighlightText.vue'
import ProxyName from '../proxies/ProxyName.vue'
import ConnectionActions from './ConnectionActions'

export default defineComponent<{
  conn: Connection
}>({
  props: {
    conn: Object,
  },
  name: 'ConnectionCard',
  setup(props) {
    const { handlerInfo } = useConnections()
    const getDisplayOptions = () => ({
      mode: 'card' as const,
      proxyChainDirection: proxyChainDirection.value,
      showFullProxyChain: showFullProxyChain.value,
    })

    return () => {
      const conn = props.conn
      const currentDisplayOptions = getDisplayOptions()
      const filter = connectionFilter.value
      const highlightedText = (key: CONNECTIONS_TABLE_ACCESSOR_KEY) => {
        const text =
          getConnectionCachedDisplayValue(conn, key) ??
          getConnectionDisplayValue(conn, key, currentDisplayOptions)

        return filter ? (
          <HighlightText
            text={text}
            filter={filter}
          />
        ) : (
          text
        )
      }
      const renderCardItem = (key: CONNECTIONS_TABLE_ACCESSOR_KEY): JSX.Element | null => {
        switch (key) {
          case CONNECTIONS_TABLE_ACCESSOR_KEY.Host:
            return <span class="text-main w-80 grow truncate">{highlightedText(key)}</span>
          case CONNECTIONS_TABLE_ACCESSOR_KEY.Destination:
          case CONNECTIONS_TABLE_ACCESSOR_KEY.RemoteAddress:
          case CONNECTIONS_TABLE_ACCESSOR_KEY.SniffHost:
          case CONNECTIONS_TABLE_ACCESSOR_KEY.Rule:
            return <span class="w-80 grow truncate break-all">{highlightedText(key)}</span>
          case CONNECTIONS_TABLE_ACCESSOR_KEY.SourceIP:
            return <span class="w-40 grow truncate break-all">{highlightedText(key)}</span>
          case CONNECTIONS_TABLE_ACCESSOR_KEY.SourcePort:
            return <span class="w-20 grow truncate break-all">{highlightedText(key)}</span>
          case CONNECTIONS_TABLE_ACCESSOR_KEY.Type:
          case CONNECTIONS_TABLE_ACCESSOR_KEY.Process:
          case CONNECTIONS_TABLE_ACCESSOR_KEY.Outbound:
            return <span class="w-60 grow truncate break-all">{highlightedText(key)}</span>
          case CONNECTIONS_TABLE_ACCESSOR_KEY.Chains: {
            if (!filter) {
              return <span class="w-80 grow truncate break-all">{highlightedText(key)}</span>
            }

            const chains = getConnectionRenderedChains(conn, currentDisplayOptions)
            const renderedChains = chains.length > 0 ? chains : ['']

            return (
              <span
                class={[
                  'flex w-80 grow items-center gap-1 truncate break-all',
                  proxyChainDirection.value === PROXY_CHAIN_DIRECTION.REVERSE &&
                    'flex-row-reverse justify-end',
                ]}
              >
                {renderedChains.map((chain, index) => (
                  <>
                    {index > 0 && <ArrowRightCircleIcon class="h-4 w-4 shrink-0" />}
                    <ProxyName
                      name={chain}
                      filter={filter}
                    />
                  </>
                ))}
              </span>
            )
          }
          case CONNECTIONS_TABLE_ACCESSOR_KEY.Download:
            return (
              <div class="flex items-center text-xs whitespace-nowrap">
                {highlightedText(key)}
                <ArrowDownIcon class="text-success ml-1 h-3 w-3" />
              </div>
            )
          case CONNECTIONS_TABLE_ACCESSOR_KEY.Upload:
            return (
              <div class="flex items-center text-xs whitespace-nowrap">
                {highlightedText(key)}
                <ArrowUpIcon class="text-info ml-1 h-3 w-3" />
              </div>
            )
          case CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed:
            return (
              <div class="flex items-center text-xs whitespace-nowrap">
                {highlightedText(key)}
                <ArrowDownCircleIcon class="text-success ml-1 h-4 w-4" />
              </div>
            )
          case CONNECTIONS_TABLE_ACCESSOR_KEY.UlSpeed:
            return (
              <div class="flex items-center text-xs whitespace-nowrap">
                {highlightedText(key)}
                <ArrowUpCircleIcon class="text-info ml-1 h-4 w-4" />
              </div>
            )
          case CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime:
          case CONNECTIONS_TABLE_ACCESSOR_KEY.DestinationType:
          case CONNECTIONS_TABLE_ACCESSOR_KEY.InboundUser:
            return <div class="whitespace-nowrap">{highlightedText(key)}</div>
          case CONNECTIONS_TABLE_ACCESSOR_KEY.Close:
            return (
              <ConnectionActions
                conn={conn}
                blockFirst
              />
            )
        }

        return null
      }
      return (
        <div
          class={[
            'scroller-item connection-row hover:bg-base-content/[0.04] flex cursor-pointer flex-col gap-1 px-3 py-2',
          ]}
          onClick={() => handlerInfo(conn)}
        >
          {connectionCardLines.value.map((line, lineIndex) => (
            <div
              key={lineIndex}
              class="flex h-5 items-center gap-1 text-sm"
            >
              {line.map((key) => {
                if (
                  key === CONNECTIONS_TABLE_ACCESSOR_KEY.Close &&
                  connectionTabShow.value === CONNECTION_TAB_TYPE.CLOSED
                ) {
                  return null
                }

                return renderCardItem(key)
              })}
            </div>
          ))}
        </div>
      )
    }
  },
})
