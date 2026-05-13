'use client'

import { FormEvent, useMemo, useState } from 'react'

import {
  AlertTriangle,
  Info,
  Play,
  Plus,
  RotateCcw,
  Trash2
} from 'lucide-react'
import { useRouter } from 'nextjs-toploader/app'

import { JsonViewer } from '@/components/data-display/json-viewer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { WalletAddressConsumer } from '@/components/wallet/wallet-address-consumer'
import { storeMarketplaceOrderSnapshot } from '@/features/marketplace/order-session-storage'
import type { ApiProduct } from '@/features/marketplace/products'
import type { MarketplaceOrder } from '@/features/marketplace/types'
import { cn } from '@/lib/utils/cn'

type RequestFieldValue = string | boolean | string[]
type ApiResponseDebug = {
  request?: {
    method: string
    url: string
    body?: unknown
  }
  response?: {
    ok: boolean
    status: number
    statusText: string
    body: unknown
  }
  error?: string
}

type OrderCreateFormProps = {
  product: Pick<
    ApiProduct,
    'slug' | 'name' | 'referencePayload' | 'requestSchema'
  >
  compact?: boolean
  providerDraftTest?: boolean
}

export function OrderCreateForm({
  product,
  compact,
  providerDraftTest
}: OrderCreateFormProps) {
  return (
    <TooltipProvider delayDuration={120}>
      <WalletAddressConsumer>
        {({ address }) => (
          <OrderCreateFormFields
            product={product}
            connectedWallet={address}
            compact={compact}
            providerDraftTest={providerDraftTest}
          />
        )}
      </WalletAddressConsumer>
    </TooltipProvider>
  )
}

function OrderCreateFormFields({
  product,
  connectedWallet,
  compact = false,
  providerDraftTest = false
}: OrderCreateFormProps & {
  connectedWallet: string | null
}) {
  const router = useRouter()
  const fieldEntries = useMemo(
    () => Object.entries(product.requestSchema),
    [product.requestSchema]
  )
  const hasStructuredFields = fieldEntries.length > 0
  const defaultValues = useMemo(
    () =>
      getInitialFieldValues(product.requestSchema, product.referencePayload),
    [product.requestSchema, product.referencePayload]
  )
  const [fieldValues, setFieldValues] =
    useState<Record<string, RequestFieldValue>>(defaultValues)
  const [rawPayloadJson, setRawPayloadJson] = useState(
    JSON.stringify(product.referencePayload, null, 2)
  )
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [responseDebug, setResponseDebug] = useState<ApiResponseDebug | null>(
    null
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [buyerWallet, setBuyerWallet] = useState(connectedWallet ?? '')

  const requestPayloadJson = useMemo(() => {
    if (!hasStructuredFields) {
      return rawPayloadJson
    }

    try {
      return JSON.stringify(
        buildPayloadFromFields(fieldEntries, fieldValues),
        null,
        2
      )
    } catch {
      return '{}'
    }
  }, [fieldEntries, fieldValues, hasStructuredFields, rawPayloadJson])

  function updateField(name: string, value: RequestFieldValue) {
    setFieldValues(current => ({ ...current, [name]: value }))
  }

  function resetSamplePayload() {
    setFieldValues(defaultValues)
    setRawPayloadJson(JSON.stringify(product.referencePayload, null, 2))
    setError('')
    setSuccess('')
    setResponseDebug(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setResponseDebug(null)
    setIsSubmitting(true)
    let debugPayload: ApiResponseDebug | null = null

    try {
      const requestPayload = hasStructuredFields
        ? buildPayloadFromFields(fieldEntries, fieldValues)
        : parseRawPayload(rawPayloadJson)

      validateBuyerWallet(buyerWallet)

      const requestBody = {
        productSlug: product.slug,
        buyerWallet,
        requestPayloadJson: JSON.stringify(requestPayload),
        allowDraftTest: Boolean(providerDraftTest)
      }
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
      const responseBody = parseResponseBody(await response.text())
      debugPayload = {
        request: {
          method: 'POST',
          url: '/api/orders',
          body: {
            ...requestBody,
            parsedRequestPayload: requestPayload
          }
        },
        response: {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          body: responseBody
        }
      }

      const order = responseBody as MarketplaceOrder & {
        error?: string
        message?: string
      }

      if (!response.ok) {
        setResponseDebug(debugPayload)
        throw new Error(
          getResponseErrorMessage(order) ?? 'Unable to prepare the API request.'
        )
      }

      setResponseDebug(null)
      setSuccess('Payable request created. Opening the Run & Pay page...')
      storeMarketplaceOrderSnapshot(order)
      router.push(`/orders/${order.id}`)
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to prepare the API request.'

      setError(message)

      if (!debugPayload) {
        setResponseDebug({ error: message })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='min-w-0 space-y-5'>
      <Card className={cn('min-w-0 overflow-hidden', compact ? 'p-5' : 'p-0')}>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div className={cn('space-y-2', !compact && 'p-6 pb-0')}>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              Test request
            </p>
            <h2 className='text-2xl font-semibold'>Build a payable API call</h2>
            <p className='text-foreground/65 mt-2 max-w-2xl text-sm leading-6'>
              Fill the fields generated from this listing schema. The gateway
              creates a payable order first; the wallet payment happens on the
              Run & Pay page before the provider receives the request.
            </p>
          </div>
          <div className={cn(!compact && 'px-6 pt-6')}>
            <Button
              type='button'
              variant='outline'
              onClick={resetSamplePayload}
            >
              <RotateCcw className='h-4 w-4' aria-hidden />
              Use sample payload
            </Button>
          </div>
        </div>

        <div className={cn('space-y-6', !compact && 'p-6')}>
          <label className='space-y-2'>
            <span className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              Buyer wallet <span className='text-red-500'>*</span>
            </span>
            <Input
              name='buyerWallet'
              value={buyerWallet}
              onChange={event => setBuyerWallet(event.target.value)}
              placeholder='Connect a wallet or paste the buyer wallet address'
              required
              pattern='^0x[a-fA-F0-9]{40}$'
            />
            <span className='text-foreground/60 block text-xs leading-5'>
              This wallet owns the request and signs the x402 payment on the
              next page.
            </span>
          </label>

          {hasStructuredFields ? (
            <div className='grid gap-4 lg:grid-cols-2'>
              {fieldEntries.map(([fieldName, fieldType]) => (
                <RequestSchemaField
                  key={fieldName}
                  name={fieldName}
                  typeLabel={fieldType}
                  value={fieldValues[fieldName] ?? ''}
                  onChange={value => updateField(fieldName, value)}
                />
              ))}
            </div>
          ) : (
            <label className='space-y-2'>
              <span className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
                Request JSON <span className='text-red-500'>*</span>
              </span>
              <textarea
                value={rawPayloadJson}
                onChange={event => setRawPayloadJson(event.target.value)}
                className='border-border bg-card text-foreground focus-visible:ring-ring focus-visible:ring-offset-background min-h-64 w-full rounded-lg border px-4 py-3 font-mono text-xs leading-6 shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
                required
              />
            </label>
          )}

          <JsonViewer
            title='JSON request preview'
            value={requestPayloadJson}
            defaultOpen={false}
            maxHeightClassName='max-h-80'
            copyLabel='Copy request JSON'
          />
        </div>
      </Card>

      <div className='border-border/80 bg-card/60 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between'>
        <Button type='submit' disabled={isSubmitting}>
          <Play className='h-4 w-4' aria-hidden />
          {isSubmitting ? 'Preparing' : 'Test run'}
        </Button>
        <div className='min-w-0 flex-1'>
          {error ? (
            <p
              className='text-sm font-semibold break-words text-red-600 dark:text-red-300'
              role='alert'
            >
              Request failed. Review the summary below.
            </p>
          ) : null}
          {success ? (
            <p
              className='text-sm font-semibold break-words text-emerald-600'
              role='status'
            >
              {success}
            </p>
          ) : null}
          {!error && !success ? (
            <p className='text-foreground/60 text-sm'>
              The provider is contacted only to price the request. Payment
              happens on the next page.
            </p>
          ) : null}
        </div>
      </div>
      {error && responseDebug ? (
        <RequestFailurePanel debug={responseDebug} message={error} />
      ) : null}
    </form>
  )
}

function RequestFailurePanel({
  debug,
  message
}: {
  debug: ApiResponseDebug
  message: string
}) {
  const status = debug.response
    ? `${debug.response.status} ${debug.response.statusText || ''}`.trim()
    : 'Client validation'
  const providerMessage = getReadableDebugMessage(debug, message)
  return (
    <Card className='min-w-0 overflow-hidden border-red-500/30 bg-red-500/5 p-0'>
      <div className='grid gap-4 p-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start'>
        <div className='flex h-11 w-11 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300'>
          <AlertTriangle className='h-5 w-5' aria-hidden />
        </div>
        <div className='min-w-0 space-y-2'>
          <p className='text-xs tracking-[0.16em] text-red-600 uppercase dark:text-red-300'>
            Request failed
          </p>
          <h3 className='text-xl font-semibold break-words'>
            Pricing request was rejected
          </h3>
          <p className='text-foreground/75 max-h-40 overflow-auto text-sm leading-6 [overflow-wrap:anywhere] whitespace-pre-wrap'>
            {providerMessage}
          </p>
        </div>
        <span className='w-fit rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-sm font-semibold text-red-700 dark:text-red-200'>
          {status}
        </span>
      </div>

      <JsonViewer
        title='View full request and response JSON'
        value={debug}
        defaultOpen={false}
        className='m-5 mt-0'
        maxHeightClassName='max-h-[28rem]'
        copyLabel='Copy error JSON'
        copiedLabel='Copied error'
      />
    </Card>
  )
}

function RequestSchemaField({
  name,
  typeLabel,
  value,
  onChange
}: {
  name: string
  typeLabel: string
  value: RequestFieldValue
  onChange: (value: RequestFieldValue) => void
}) {
  const label = humanizeFieldName(name)
  const required = isRequiredField(typeLabel)
  const options = getLiteralOptions(typeLabel)
  const itemOptions = getArrayItemOptions(typeLabel)
  const fieldHelp = getFieldHelp(typeLabel)
  const baseTypeLabel = stripFieldHelp(typeLabel)
  const lowerName = name.toLowerCase()
  const lowerType = baseTypeLabel.toLowerCase()
  const isBoolean = lowerType.includes('boolean')
  const isNumber =
    lowerType.includes('number') ||
    lowerType.includes('integer') ||
    lowerType.includes('float')
  const isUrl = lowerName.includes('url') || lowerType.includes('url')
  const isArray = isArrayType(lowerType)
  const isLongText =
    lowerName.includes('prompt') ||
    lowerName.includes('script') ||
    lowerName.includes('summary') ||
    lowerName.includes('description') ||
    lowerName.includes('context') ||
    isArray ||
    lowerType.includes('object') ||
    lowerType.includes('array') ||
    lowerType.includes('json')

  return (
    <label className={cn('space-y-2', isLongText && 'lg:col-span-2')}>
      <span className='text-foreground/60 flex flex-wrap items-center gap-2 text-xs tracking-[0.16em] uppercase'>
        <span className='inline-flex min-w-0 items-center gap-1.5'>
          <span>{label}</span>
          {required ? <span className='text-red-500'>*</span> : null}
          {fieldHelp ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type='button'
                  className='text-foreground/60 hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
                  aria-label={`${label} help`}
                >
                  <Info className='h-3.5 w-3.5' aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className='font-semibold tracking-normal normal-case'>
                  {label}
                </p>
                <p className='text-card-foreground/80 mt-1 tracking-normal normal-case'>
                  {fieldHelp}
                </p>
              </TooltipContent>
            </Tooltip>
          ) : null}
        </span>
        <span className='bg-muted text-foreground/70 rounded-md px-2 py-1 font-mono text-[0.65rem] tracking-normal normal-case'>
          {baseTypeLabel}
        </span>
      </span>
      {isBoolean ? (
        <select
          value={String(value || false)}
          onChange={event => onChange(event.target.value === 'true')}
          required={required}
          className='border-border bg-card text-foreground focus-visible:ring-ring focus-visible:ring-offset-background h-11 w-full rounded-lg border px-4 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
        >
          <option value='true'>true</option>
          <option value='false'>false</option>
        </select>
      ) : isArray ? (
        <ArrayFieldInput
          value={Array.isArray(value) ? value : parseArrayInputValue(value)}
          onChange={onChange}
          options={itemOptions}
          required={required}
        />
      ) : options.length > 0 ? (
        <select
          value={String(value)}
          onChange={event => onChange(event.target.value)}
          required={required}
          className='border-border bg-card text-foreground focus-visible:ring-ring focus-visible:ring-offset-background h-11 w-full rounded-lg border px-4 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
        >
          {!required ? <option value=''>Leave empty</option> : null}
          {options.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : isLongText ? (
        <textarea
          value={String(value)}
          onChange={event => onChange(event.target.value)}
          required={required}
          className='border-border bg-card text-foreground focus-visible:ring-ring focus-visible:ring-offset-background min-h-32 w-full rounded-lg border px-4 py-3 text-sm leading-6 shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
        />
      ) : (
        <Input
          type={isNumber ? 'number' : isUrl ? 'url' : 'text'}
          step={isNumber ? 'any' : undefined}
          value={String(value)}
          onChange={event => onChange(event.target.value)}
          required={required}
        />
      )}
    </label>
  )
}

function getInitialFieldValues(
  schema: Record<string, string>,
  referencePayload: Record<string, unknown>
) {
  return Object.fromEntries(
    Object.entries(schema).map(([fieldName, fieldType]) => {
      const referenceValue = referencePayload[fieldName]

      return [
        fieldName,
        isArrayType(stripFieldHelp(fieldType).toLowerCase())
          ? stringifyReferenceArrayValue(referenceValue)
          : stringifyReferenceValue(referenceValue)
      ]
    })
  ) as Record<string, RequestFieldValue>
}

function stringifyReferenceArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map(item =>
    typeof item === 'string' ? item : JSON.stringify(item)
  )
}

function stringifyReferenceValue(value: unknown): RequestFieldValue {
  if (typeof value === 'boolean') {
    return value
  }

  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }

  return String(value)
}

function buildPayloadFromFields(
  fieldEntries: [string, string][],
  fieldValues: Record<string, RequestFieldValue>
) {
  return Object.fromEntries(
    fieldEntries
      .map(([fieldName, typeLabel]) => [
        fieldName,
        coerceFieldValue(fieldName, typeLabel, fieldValues[fieldName])
      ])
      .filter(([, value]) => value !== undefined)
  )
}

function coerceFieldValue(
  fieldName: string,
  typeLabel: string,
  value: RequestFieldValue | undefined
) {
  const baseTypeLabel = stripFieldHelp(typeLabel)
  const lowerType = baseTypeLabel.toLowerCase()
  const lowerName = fieldName.toLowerCase()
  const required = isRequiredField(typeLabel)
  const isArray = isArrayType(lowerType)
  const literalOptions = getLiteralOptions(baseTypeLabel)

  if (
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  ) {
    if (required) {
      throw new Error(`${humanizeFieldName(fieldName)} is required.`)
    }

    return undefined
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (isArray) {
    return parseArrayValue(value, fieldName)
  }

  const stringValue = Array.isArray(value) ? value.join(',') : value

  if (literalOptions.length > 0) {
    const literalValue = String(stringValue)

    if (!literalOptions.includes(literalValue)) {
      throw new Error(
        `${humanizeFieldName(fieldName)} must be ${literalOptions.join(' or ')}.`
      )
    }

    return literalValue
  }

  if (
    lowerType.includes('number') ||
    lowerType.includes('integer') ||
    lowerType.includes('float')
  ) {
    const numberValue = Number(stringValue)

    if (!Number.isFinite(numberValue)) {
      throw new Error(`${humanizeFieldName(fieldName)} must be a number.`)
    }

    return numberValue
  }

  if (lowerName.includes('url') || lowerType.includes('url')) {
    try {
      return new URL(stringValue).toString()
    } catch {
      throw new Error(`${humanizeFieldName(fieldName)} must be a valid URL.`)
    }
  }

  if (
    lowerType.includes('object') ||
    lowerType.includes('array') ||
    lowerType.includes('json')
  ) {
    try {
      return JSON.parse(stringValue) as unknown
    } catch {
      throw new Error(`${humanizeFieldName(fieldName)} must be valid JSON.`)
    }
  }

  return stringValue
}

function parseRawPayload(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Request JSON must be an object.')
    }

    return parsed
  } catch {
    throw new Error('Request JSON must be a valid JSON object.')
  }
}

function parseResponseBody(value: string) {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

function getResponseErrorMessage(value: { error?: string; message?: string }) {
  if (value.error && value.message) {
    return `${value.error} ${value.message}`
  }

  return value.error ?? value.message
}

function getReadableDebugMessage(debug: ApiResponseDebug, fallback: string) {
  const responseBody = debug.response?.body

  if (responseBody && typeof responseBody === 'object') {
    const body = responseBody as Record<string, unknown>
    const nestedError = body.error

    if (nestedError && typeof nestedError === 'object') {
      const nestedMessage = (nestedError as Record<string, unknown>).message

      if (typeof nestedMessage === 'string') {
        return nestedMessage
      }
    }

    if (typeof body.message === 'string') {
      return extractProviderMessage(body.message) ?? body.message
    }

    if (typeof body.error === 'string') {
      return body.error
    }
  }

  return fallback || debug.error || 'Unable to prepare the payable request.'
}

function extractProviderMessage(value: string) {
  const marker = 'Response body:'
  const markerIndex = value.indexOf(marker)

  if (markerIndex < 0) {
    return null
  }

  const bodyText = value.slice(markerIndex + marker.length).trim()

  try {
    const body = JSON.parse(bodyText) as unknown

    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>
      const error = record.error

      if (error && typeof error === 'object') {
        const message = (error as Record<string, unknown>).message

        if (typeof message === 'string') {
          return message
        }
      }

      const title = typeof record.title === 'string' ? record.title : ''
      const detail = typeof record.detail === 'string' ? record.detail : ''
      const retryAfter =
        typeof record.retry_after === 'number'
          ? ` Retry after ${record.retry_after} seconds.`
          : ''

      if (title && detail) {
        return `${title}. ${detail}${retryAfter}`
      }

      if (detail) {
        return `${detail}${retryAfter}`
      }

      if (title) {
        return `${title}${retryAfter}`
      }
    }
  } catch {
    return null
  }

  return null
}

function parseArrayValue(value: RequestFieldValue, fieldName: string) {
  if (Array.isArray(value)) {
    return value.map(item => item.trim()).filter(Boolean)
  }

  if (typeof value === 'boolean') {
    throw new Error(`${humanizeFieldName(fieldName)} must be a valid array.`)
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return []
  }

  if (!trimmed.startsWith('[')) {
    return trimmed
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown

    if (!Array.isArray(parsed)) {
      throw new Error(`${humanizeFieldName(fieldName)} must be a JSON array.`)
    }

    return parsed
  } catch {
    throw new Error(`${humanizeFieldName(fieldName)} must be a valid array.`)
  }
}

function validateBuyerWallet(value: string) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error('Buyer wallet must be a valid 0x wallet address.')
  }
}

function isRequiredField(typeLabel: string) {
  if (/undefined|optional|null/i.test(typeLabel)) {
    return false
  }

  return /\brequired\b/i.test(typeLabel)
}

function getLiteralOptions(typeLabel: string) {
  const baseTypeLabel = stripFieldHelp(typeLabel)

  if (isArrayType(baseTypeLabel.toLowerCase())) {
    return []
  }

  return stripRequirementLabel(baseTypeLabel)
    .split('|')
    .map(option => {
      const rawOption = option.trim()
      const isQuotedLiteral =
        /^"[^"]*"$/.test(rawOption) || /^'[^']*'$/.test(rawOption)

      return {
        value: rawOption.replace(/^['"]|['"]$/g, ''),
        isQuotedLiteral
      }
    })
    .filter(
      option =>
        option.isQuotedLiteral &&
        Boolean(option.value) &&
        !/undefined|optional|null/i.test(option.value)
    )
    .map(option => option.value)
}

function isArrayType(lowerTypeLabel: string) {
  return (
    lowerTypeLabel.includes('[]') ||
    lowerTypeLabel.includes('array') ||
    lowerTypeLabel.startsWith('array<')
  )
}

function stripRequirementLabel(typeLabel: string) {
  return typeLabel.replace(/\s*\((required|optional)\)\s*$/i, '')
}

function stripFieldHelp(typeLabel: string) {
  return typeLabel.split(/\s+—\s+/)[0]?.trim() ?? typeLabel
}

function getFieldHelp(typeLabel: string) {
  return typeLabel
    .split(/\s+—\s+/)
    .slice(1)
    .join(' — ')
    .trim()
}

function getArrayItemOptions(typeLabel: string) {
  const match = stripRequirementLabel(stripFieldHelp(typeLabel)).match(
    /^array<(.+)>$/i
  )

  if (!match) {
    return []
  }

  return match[1]
    .split('|')
    .map(option => option.trim().replace(/^['"]|['"]$/g, ''))
    .filter(
      option => option && !/^(string|number|integer|object)$/i.test(option)
    )
}

function parseArrayInputValue(value: RequestFieldValue): string[] {
  if (Array.isArray(value)) {
    return value
  }

  if (typeof value === 'boolean' || !value.trim()) {
    return []
  }

  if (value.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(value) as unknown
      return Array.isArray(parsed) ? parsed.map(item => String(item)) : []
    } catch {
      return []
    }
  }

  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function ArrayFieldInput({
  value,
  onChange,
  options,
  required
}: {
  value: string[]
  onChange: (value: RequestFieldValue) => void
  options: string[]
  required: boolean
}) {
  const rows = value.length > 0 ? value : ['']

  function updateItem(index: number, nextValue: string) {
    const nextRows = [...rows]
    nextRows[index] = nextValue
    onChange(nextRows.map(item => item.trim()).filter(Boolean))
  }

  function removeItem(index: number) {
    onChange(rows.filter((_, rowIndex) => rowIndex !== index).filter(Boolean))
  }

  return (
    <div className='space-y-2'>
      {rows.map((item, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: Rows are simple editable values without stable IDs.
          key={index}
          className='flex gap-2'
        >
          {options.length > 0 ? (
            <select
              value={item}
              onChange={event => updateItem(index, event.target.value)}
              required={required && index === 0}
              className='border-border bg-card text-foreground focus-visible:ring-ring focus-visible:ring-offset-background h-11 min-w-0 flex-1 rounded-lg border px-4 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
            >
              <option value=''>Select value</option>
              {options.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <Input
              value={item}
              onChange={event => updateItem(index, event.target.value)}
              required={required && index === 0}
              placeholder='Array item'
            />
          )}
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-11 w-11 shrink-0 px-0'
            onClick={() => removeItem(index)}
            disabled={rows.length === 1 && !item}
            aria-label='Remove array item'
          >
            <Trash2 className='h-4 w-4' aria-hidden />
          </Button>
        </div>
      ))}
      <Button
        type='button'
        variant='outline'
        onClick={() => onChange([...rows, ''])}
      >
        <Plus className='h-4 w-4' aria-hidden />
        Add value
      </Button>
    </div>
  )
}

function humanizeFieldName(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
}
