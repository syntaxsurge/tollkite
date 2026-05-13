export const appOrderIdHeader = 'x-app-order-id'
export const legacyOrderIdHeader = 'x-tollkite-order-id'
export const appAgentRunIdHeader = 'x-app-agent-run-id'

export function getAppOrderIdHeader(
  getHeader: (name: string) => string | null | undefined
) {
  return getHeader(appOrderIdHeader) ?? getHeader(legacyOrderIdHeader)
}
