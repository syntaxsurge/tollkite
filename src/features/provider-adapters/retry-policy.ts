import type { MarketplaceOrder } from '@/features/marketplace/types'
import type { ProviderAdapterResult } from '@/features/provider-adapters/types'

export const PROVIDER_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000
export const PROVIDER_RETRY_DEFAULT_AFTER_SECONDS = 60
export const PROVIDER_RETRY_MAX_RETRIES = 3

type RetryableProviderFailure = {
  retryable: true
  reason: string
  retryAfterSeconds: number
  retryUntil: string
  expired: boolean
  attempts: number
}

type TerminalProviderFailure = {
  retryable: false
  reason: string
}

export type ProviderFailurePolicy =
  | RetryableProviderFailure
  | TerminalProviderFailure

export function classifyProviderFailure({
  providerResult,
  order,
  now = new Date()
}: {
  providerResult: ProviderAdapterResult
  order?: Pick<MarketplaceOrder, 'providerRetry'>
  now?: Date
}): ProviderFailurePolicy {
  const payload = asRecord(providerResult.responsePayload)
  const status = getNumeric(payload.status) ?? getNumeric(payload.error_code)
  const retryableFlag = payload.retryable
  const isCloudflareTransient = payload.cloudflare_error === true
  const isRetryableStatus = Boolean(
    status && [408, 425, 429, 500, 502, 503, 504].includes(status)
  )
  const message = [
    stringify(payload.title),
    stringify(payload.detail),
    providerResult.errorMessage
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  const messageLooksTransient =
    /\b(408|425|429|500|502|503|504)\b/.test(message) ||
    message.includes('bad gateway') ||
    message.includes('timeout') ||
    message.includes('temporar') ||
    message.includes('overload') ||
    message.includes('rate limit') ||
    message.includes('unavailable')
  const retryable =
    retryableFlag === true ||
    isCloudflareTransient ||
    isRetryableStatus ||
    messageLooksTransient

  if (!retryable) {
    return {
      retryable: false,
      reason:
        providerResult.errorMessage ?? 'Provider returned a terminal error.'
    }
  }

  const firstFailureAt =
    order?.providerRetry?.firstFailureAt &&
    isValidDate(order.providerRetry.firstFailureAt)
      ? order.providerRetry.firstFailureAt
      : now.toISOString()
  const retryUntil = new Date(
    Date.parse(firstFailureAt) + PROVIDER_RETRY_WINDOW_MS
  ).toISOString()
  const retryAfterSeconds =
    getNumeric(payload.retry_after) ??
    order?.providerRetry?.retryAfterSeconds ??
    PROVIDER_RETRY_DEFAULT_AFTER_SECONDS
  const attempts = (order?.providerRetry?.attempts ?? 0) + 1

  return {
    retryable: true,
    reason:
      stringify(payload.what_you_should_do) ||
      stringify(payload.detail) ||
      providerResult.errorMessage ||
      'Provider returned a retryable temporary error.',
    retryAfterSeconds: Math.max(5, Math.floor(retryAfterSeconds)),
    retryUntil,
    expired:
      now.getTime() >= Date.parse(retryUntil) ||
      attempts > PROVIDER_RETRY_MAX_RETRIES,
    attempts
  }
}

function getNumeric(value: unknown) {
  const numberValue = Number(value)

  return Number.isFinite(numberValue) ? numberValue : undefined
}

function stringify(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function isValidDate(value: string) {
  return Number.isFinite(Date.parse(value))
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
