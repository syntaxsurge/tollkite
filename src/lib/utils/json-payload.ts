const indexedKeyPattern = /^\d+$/
const indexedKeyThreshold = 100
const defaultCompactPayloadBytes = 12_000
const compactRecordKeys = [
  'id',
  'status',
  'stage',
  'progress',
  'jobId',
  'externalJobId',
  'requestId',
  'resultUrl',
  'renderUrl',
  'previewUrl',
  'publicProjectUrl',
  'projectUrl',
  'cloneUrl',
  'outputUrl',
  'url',
  'error',
  'errorMessage',
  'message',
  'resultReleaseStatus',
  'escrowStatus',
  'amountUsdt',
  'paidAmountUsdt',
  'actualAmountUsdt',
  'deltaAmountUsdt',
  'receiptId',
  'explorerUrl',
  'createdAt',
  'updatedAt',
  'billing',
  'pricing',
  'escrow',
  'result'
]

export function omitIndexedCharacterMaps(value: unknown, depth = 0): unknown {
  if (depth > 12) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(item => omitIndexedCharacterMaps(item, depth + 1))
  }

  if (!isPlainRecord(value)) {
    return value
  }

  const entries = Object.entries(value)
  const indexedKeyCount = entries.filter(([key]) =>
    indexedKeyPattern.test(key)
  ).length
  const shouldDropIndexedKeys = indexedKeyCount > indexedKeyThreshold
  const normalizedEntries = entries
    .filter(([key]) => !shouldDropIndexedKeys || !indexedKeyPattern.test(key))
    .map(([key, item]) => [key, omitIndexedCharacterMaps(item, depth + 1)])

  if (!shouldDropIndexedKeys) {
    return Object.fromEntries(normalizedEntries)
  }

  return {
    ...Object.fromEntries(normalizedEntries),
    omittedIndexedCharacters: indexedKeyCount
  }
}

export function compactJsonPayload(
  value: unknown,
  maxBytes = defaultCompactPayloadBytes
): unknown {
  if (value === undefined) {
    return undefined
  }

  const normalized = omitIndexedCharacterMaps(value)

  if (typeof normalized === 'string') {
    return normalized.length <= 1000
      ? normalized
      : { value: normalized.slice(0, 1000), omittedLargePayload: true }
  }

  if (
    typeof normalized === 'number' ||
    typeof normalized === 'boolean' ||
    normalized === null
  ) {
    return normalized
  }

  if (
    isPlainRecord(normalized) &&
    normalized.omittedLargePayload === true &&
    typeof normalized.value === 'string'
  ) {
    return normalized.value
  }

  if (serializedLength(normalized) <= maxBytes) {
    return normalized
  }

  if (Array.isArray(normalized)) {
    return {
      items: normalized
        .slice(0, 5)
        .map(item => compactJsonPayload(item, Math.floor(maxBytes / 2))),
      omittedLargePayload: true,
      originalItemCount: normalized.length
    }
  }

  if (!isPlainRecord(normalized)) {
    return {
      value: typeof normalized === 'string' ? normalized.slice(0, 1000) : null,
      omittedLargePayload: true
    }
  }

  const compactEntries = compactRecordKeys
    .filter(key => key in normalized)
    .map(key => [
      key,
      key === 'billing'
        ? compactBillingPayload(normalized[key])
        : key === 'result'
          ? compactResultPayload(normalized[key])
          : compactJsonPayload(normalized[key], Math.floor(maxBytes / 2))
    ])
    .filter(([, item]) => item !== undefined)

  return {
    ...Object.fromEntries(compactEntries),
    omittedLargePayload: true
  }
}

export function compactProviderRequestTrace(value: unknown): unknown {
  if (!isPlainRecord(value)) {
    return compactJsonPayload(value)
  }

  return {
    method: value.method,
    url: value.url,
    requestHeaders: compactJsonPayload(value.requestHeaders, 3000),
    requestQuery: compactJsonPayload(value.requestQuery, 3000),
    responseStatus: value.responseStatus,
    responseStatusText: value.responseStatusText,
    responseHeaders: compactJsonPayload(value.responseHeaders, 3000),
    responseBody: compactJsonPayload(value.responseBody, 0),
    note: value.note,
    omittedLargePayload: serializedLength(value) > defaultCompactPayloadBytes
  }
}

function compactBillingPayload(value: unknown) {
  if (!isPlainRecord(value)) {
    return compactJsonPayload(value)
  }

  return {
    unit: value.unit,
    estimatedCredits: value.estimatedCredits,
    chargedCredits: value.chargedCredits,
    refundedCredits: value.refundedCredits,
    billableCredits: value.billableCredits,
    billingStatus: value.billingStatus,
    refundReason: value.refundReason
  }
}

function compactResultPayload(value: unknown) {
  if (!isPlainRecord(value)) {
    return compactJsonPayload(value)
  }

  return compactJsonPayload(value, 4000)
}

function serializedLength(value: unknown) {
  try {
    return JSON.stringify(value).length
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      Object.prototype.toString.call(value) === '[object Object]'
  )
}
