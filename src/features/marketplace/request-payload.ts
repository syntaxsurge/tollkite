import type { ApiProduct } from '@/features/marketplace/products'

export function sanitizeProductRequestPayload({
  product,
  payload
}: {
  product: Pick<ApiProduct, 'requestSchema'>
  payload: unknown
}) {
  if (!isPlainRecord(payload)) {
    return payload
  }

  const sanitized = Object.entries(payload).reduce<Record<string, unknown>>(
    (nextPayload, [key, value]) => {
      const fieldDescription = product.requestSchema[key]
      const isOptional = isOptionalSchemaField(fieldDescription)

      if (
        isOptional &&
        typeof value === 'string' &&
        value.trim().length === 0
      ) {
        return nextPayload
      }

      nextPayload[key] = value
      return nextPayload
    },
    {}
  )

  return sanitized
}

function isOptionalSchemaField(description: string | undefined) {
  if (!description) {
    return false
  }

  return (
    description.includes('(optional)') ||
    description.includes('undefined') ||
    description.includes('optional')
  )
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      Object.prototype.toString.call(value) === '[object Object]'
  )
}
