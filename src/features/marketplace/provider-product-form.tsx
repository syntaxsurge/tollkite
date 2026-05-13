'use client'

import { FormEvent, type ReactNode, useRef, useState } from 'react'

import { BookOpen, CheckCircle2, Eye, EyeOff, X } from 'lucide-react'
import { useRouter } from 'nextjs-toploader/app'
import { createPortal } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type {
  OpenApiImportCandidate,
  OpenApiPollingCandidate
} from '@/features/marketplace/openapi-import'
import type {
  ApiProductAuthType,
  ApiProductExecutionMode,
  ApiProductPricingModel
} from '@/features/marketplace/products'
import {
  apiProductAuthTypes,
  apiProductCategories,
  apiProductExecutionModes,
  apiProductPricingModels,
  apiProductResultDeliveries,
  apiProductSettlementModels,
  providerProductInputSchema
} from '@/features/marketplace/schemas'
import { cn } from '@/lib/utils/cn'

const emptyJsonObject = JSON.stringify({}, null, 2)
type FieldErrors = Record<string, string>

export function ProviderProductForm() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [authType, setAuthType] = useState<ApiProductAuthType>('bearer')
  const [pricingModel, setPricingModel] =
    useState<ApiProductPricingModel>('fixed')
  const [executionMode, setExecutionMode] =
    useState<ApiProductExecutionMode>('synchronous')
  const authSecretIsRequired = [
    'bearer',
    'api_key_header',
    'api_key_query'
  ].includes(authType)
  const isBasicAuth = authType === 'basic'
  const isQueryKeyAuth = authType === 'api_key_query'
  const isHeaderAuth = authType === 'bearer' || authType === 'api_key_header'
  const isAsyncProduct = executionMode === 'asynchronous'
  const isCreditMetered = pricingModel === 'credit_metered'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('')
    setError('')
    setFieldErrors({})

    const formData = new FormData(event.currentTarget)
    const payload = Object.fromEntries(formData.entries())
    const isAgentReady = formData.get('isAgentReady') === 'on'
    const requestBody = {
      ...payload,
      priceUsd: Number(payload.priceUsd),
      timeoutSeconds: Number(payload.timeoutSeconds),
      isX402Protected: true,
      isAgentReady
    }
    const validated = providerProductInputSchema.safeParse(requestBody)

    if (!validated.success) {
      setFieldErrors(flattenFieldErrors(validated.error.flatten().fieldErrors))
      setError('Fix the highlighted fields before saving this API product.')
      focusFirstInvalidField(
        event.currentTarget,
        Object.keys(validated.error.flatten().fieldErrors)
      )
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/providers/self/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated.data)
      })
      const data = (await response.json()) as {
        error?: string
        slug?: string
        issues?: Record<string, string[]>
      }

      if (!response.ok) {
        if (data.issues) {
          setFieldErrors(flattenFieldErrors(data.issues))
        }

        throw new Error(data.error ?? 'Unable to create the API product.')
      }

      setStatus('API product saved and ready for review.')
      router.push(`/provider/products/${data.slug}`)
      router.refresh()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to create the API product.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function applyOpenApiCandidate(candidate: OpenApiImportCandidate) {
    const form = formRef.current

    if (!form) {
      return
    }

    setFormValue(form, 'name', candidate.name)
    setFormValue(form, 'slug', candidate.slug)
    setFormValue(form, 'category', candidate.category)
    setFormValue(
      form,
      'description',
      `${candidate.name} from imported OpenAPI operation ${candidate.label}.`
    )
    setPricingModel(candidate.pricingModel)
    setFormValue(form, 'pricingModel', candidate.pricingModel)
    setFormValue(
      form,
      'pricingQuoteEndpointUrl',
      candidate.pricingQuoteEndpointUrl
    )
    setFormValue(form, 'pricingQuoteMethod', candidate.pricingQuoteMethod)
    setFormValue(form, 'pricingCreditUnitPath', candidate.pricingCreditUnitPath)
    setFormValue(
      form,
      'pricingUsageCreditPath',
      candidate.pricingUsageCreditPath
    )
    setFormValue(
      form,
      'pricingCreditToUsdtRate',
      candidate.pricingCreditToUsdtRate
    )
    setFormValue(form, 'pricingMultiplier', candidate.pricingMultiplier)
    setFormValue(
      form,
      'pricingMinimumChargeUsd',
      candidate.pricingMinimumChargeUsd
    )
    setFormValue(
      form,
      'pricingMaximumChargeUsd',
      candidate.pricingMaximumChargeUsd
    )
    setFormValue(form, 'endpointUrl', candidate.endpointUrl)
    setFormValue(form, 'method', candidate.method)
    setAuthType(candidate.authType)
    setFormValue(form, 'authType', candidate.authType)
    setFormValue(form, 'authHeaderName', candidate.authHeaderName)
    setFormValue(form, 'authQueryParam', candidate.authQueryParam)
    setExecutionMode(candidate.executionMode)
    setFormValue(form, 'executionMode', candidate.executionMode)
    setFormValue(form, 'settlementModel', candidate.settlementModel)
    setFormValue(form, 'resultDelivery', candidate.resultDelivery)
    setFormValue(form, 'estimatedLatency', candidate.estimatedLatency)
    setFormValue(form, 'statusEndpointUrl', candidate.statusEndpointUrl)
    setFormValue(form, 'statusMethod', candidate.statusMethod)
    setFormValue(form, 'externalJobIdPath', candidate.externalJobIdPath)
    setFormValue(form, 'statusPath', candidate.statusPath)
    setFormValue(form, 'resultUrlPath', candidate.resultUrlPath)
    setFormValue(form, 'errorMessagePath', candidate.errorMessagePath)
    setFormValue(
      form,
      'requestSchemaJson',
      JSON.stringify(candidate.requestSchema, null, 2)
    )
    setFormValue(
      form,
      'responseSchemaJson',
      JSON.stringify(candidate.responseSchema, null, 2)
    )
    setFormValue(
      form,
      'referencePayloadJson',
      JSON.stringify(candidate.referencePayload, null, 2)
    )
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className='space-y-6'
      noValidate
    >
      <OpenApiImportPanel onApply={applyOpenApiCandidate} />

      <Card className='space-y-5'>
        <SectionHeader
          eyebrow='Product details'
          title='API listing'
          docId='section-product-details'
        />
        <div className='grid gap-4 md:grid-cols-2'>
          <Field
            label='Product name'
            name='name'
            defaultValue=''
            error={fieldErrors.name}
            help='The buyer-facing name shown in the marketplace and receipts.'
          />
          <Field
            label='Slug'
            name='slug'
            defaultValue=''
            error={fieldErrors.slug}
            help='Stable URL identifier for the gateway endpoint. Use lowercase letters, numbers, and hyphens.'
          />
          <SelectField
            label='Category'
            name='category'
            defaultValue='media'
            error={fieldErrors.category}
            help='Marketplace grouping used for discovery and filtering.'
          >
            {apiProductCategories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </SelectField>
          <Field
            label='Provider endpoint URL'
            name='endpointUrl'
            type='url'
            defaultValue=''
            error={fieldErrors.endpointUrl}
            help='The real upstream URL the gateway forwards paid requests to after settlement.'
          />
          <SelectField
            label='HTTP method'
            name='method'
            defaultValue='POST'
            error={fieldErrors.method}
            help='The upstream method for this product operation.'
          >
            <option value='POST'>POST</option>
            <option value='GET'>GET</option>
          </SelectField>
          <SelectField
            label='Visibility'
            name='status'
            defaultValue='draft'
            error={fieldErrors.status}
            help='Draft keeps the listing private; published makes it available to buyers and agents.'
          >
            <option value='draft'>Draft</option>
            <option value='published'>Published</option>
            <option value='paused'>Paused</option>
          </SelectField>
        </div>
        <JsonTextField
          label='Description'
          name='description'
          defaultValue=''
          error={fieldErrors.description}
          help='Short explanation of what buyers receive from this API operation.'
          minHeight='min-h-28'
          required
        />
      </Card>

      <Card className='space-y-5'>
        <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
          <div>
            <SectionHeader
              eyebrow='Pricing'
              title='Fixed or usage-based USDT'
              docId='section-pricing'
            />
            <p className='text-foreground/65 mt-2 max-w-3xl text-sm leading-6'>
              Use fixed pricing for simple APIs. Use credit-metered pricing for
              variable-cost APIs where a quote or job response returns a numeric
              usage value that the gateway converts into USDT before x402
              payment.
            </p>
          </div>
          <span className='border-border bg-background/70 text-foreground/70 inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold'>
            {isCreditMetered ? 'Dynamic quote' : 'Fixed price'}
          </span>
        </div>
        <div className='grid gap-4 md:grid-cols-2'>
          <SelectField
            label='Pricing model'
            name='pricingModel'
            defaultValue='fixed'
            value={pricingModel}
            onChange={value => setPricingModel(value as ApiProductPricingModel)}
            error={fieldErrors.pricingModel}
            help='Fixed charges one USDT amount per call. Credit-metered reads a credit value and converts it into USDT.'
          >
            {apiProductPricingModels.map(model => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </SelectField>
          <Field
            label={isCreditMetered ? 'Fallback price in USDT' : 'Price in USDT'}
            name='priceUsd'
            type='number'
            step='0.000001'
            defaultValue=''
            error={fieldErrors.priceUsd}
            help='Fixed charge for fixed pricing. For credit-metered pricing, this is the safe fallback if quote calculation is unavailable.'
          />
          <Field
            label='Quote endpoint URL'
            name='pricingQuoteEndpointUrl'
            type='url'
            defaultValue=''
            required={false}
            error={fieldErrors.pricingQuoteEndpointUrl}
            help='Optional provider quote endpoint the gateway calls before x402 payment to calculate usage-based price from the request payload.'
          />
          <SelectField
            label='Quote method'
            name='pricingQuoteMethod'
            defaultValue='POST'
            required={false}
            error={fieldErrors.pricingQuoteMethod}
            help='HTTP method for the quote endpoint.'
          >
            <option value='POST'>POST</option>
            <option value='GET'>GET</option>
          </SelectField>
          <Field
            label='Credit value path'
            name='pricingCreditUnitPath'
            defaultValue='estimatedCredits'
            required={isCreditMetered}
            error={fieldErrors.pricingCreditUnitPath}
            help='Dot-path to the numeric usage value in the quote response, provider response, or request payload. Common examples are estimatedCredits, usage.estimatedCredits, or billing.estimatedCredits.'
          />
          <Field
            label='Actual usage path'
            name='pricingUsageCreditPath'
            defaultValue='chargedCredits'
            required={false}
            error={fieldErrors.pricingUsageCreditPath}
            help='Optional dot-path for the provider response field that reports final credits used for receipts and audit metadata.'
          />
          <Field
            label='USDT per credit'
            name='pricingCreditToUsdtRate'
            type='number'
            step='0.000001'
            defaultValue='0.01'
            required={isCreditMetered}
            error={fieldErrors.pricingCreditToUsdtRate}
            help='Conversion rate used to turn provider credits into USDT. Example: 0.01 means 100 credits equals 1 USDT.'
          />
          <Field
            label='Pricing multiplier'
            name='pricingMultiplier'
            type='number'
            step='0.000001'
            defaultValue='1'
            required={isCreditMetered}
            error={fieldErrors.pricingMultiplier}
            help='Optional markup or discount multiplier applied after converting credits into USDT.'
          />
          <Field
            label='Minimum charge USDT'
            name='pricingMinimumChargeUsd'
            type='number'
            step='0.000001'
            defaultValue='0'
            required={false}
            error={fieldErrors.pricingMinimumChargeUsd}
            help='Optional floor so tiny usage still covers gateway and provider overhead.'
          />
          <Field
            label='Maximum charge USDT'
            name='pricingMaximumChargeUsd'
            type='number'
            step='0.000001'
            defaultValue=''
            required={false}
            error={fieldErrors.pricingMaximumChargeUsd}
            help='Optional cap for buyer safety. Leave blank for no cap.'
          />
        </div>
      </Card>

      <Card className='space-y-5'>
        <div>
          <SectionHeader
            eyebrow='Provider authentication'
            title='Private upstream API'
            docId='section-provider-authentication'
          />
          <p className='text-foreground/65 mt-2 text-sm leading-6'>
            the gateway keeps this credential server-side and uses it only when
            a paid buyer request is forwarded to the provider API.
          </p>
        </div>
        <div className='grid gap-4 md:grid-cols-2'>
          <SelectField
            label='Auth type'
            name='authType'
            defaultValue='bearer'
            value={authType}
            onChange={value => setAuthType(value as ApiProductAuthType)}
            error={fieldErrors.authType}
            help='How the gateway authenticates to the upstream provider API.'
          >
            {apiProductAuthTypes.map(type => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </SelectField>
          <Field
            label='Auth secret or API key'
            name='authSecret'
            type='password'
            defaultValue=''
            required={authSecretIsRequired}
            error={fieldErrors.authSecret}
            help='Provider API key or token. Imported OpenAPI operations that declare bearer or API-key security require this secret before the gateway can forward paid calls.'
          />
          <Field
            label='Header name'
            name='authHeaderName'
            defaultValue='Authorization'
            required={isHeaderAuth}
            error={fieldErrors.authHeaderName}
            help='Header used for bearer or API-key-header auth.'
          />
          <Field
            label='Query parameter name'
            name='authQueryParam'
            defaultValue=''
            required={isQueryKeyAuth}
            error={fieldErrors.authQueryParam}
            help='Query parameter used when auth type is api_key_query.'
          />
          <Field
            label='Basic auth username'
            name='authUsername'
            defaultValue=''
            required={isBasicAuth}
            error={fieldErrors.authUsername}
            help='Username used only when auth type is basic.'
          />
          <Field
            label='Basic auth password'
            name='authPassword'
            type='password'
            defaultValue=''
            required={isBasicAuth}
            error={fieldErrors.authPassword}
            help='Password used only when auth type is basic.'
          />
        </div>
      </Card>

      <Card className='space-y-5'>
        <SectionHeader
          eyebrow='Runtime model'
          title='Sync, async, and settlement behavior'
          docId='section-runtime-model'
        />
        <div className='grid gap-4 md:grid-cols-2'>
          <SelectField
            label='Execution mode'
            name='executionMode'
            defaultValue='synchronous'
            value={executionMode}
            onChange={value =>
              setExecutionMode(value as ApiProductExecutionMode)
            }
            error={fieldErrors.executionMode}
            help='Synchronous APIs return the final result immediately; asynchronous APIs return a job ID.'
          >
            {apiProductExecutionModes.map(mode => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </SelectField>
          <SelectField
            label='Settlement model'
            name='settlementModel'
            defaultValue='pay_on_successful_response'
            error={fieldErrors.settlementModel}
            help='Defines when the buyer should pay relative to provider success or job acceptance.'
          >
            {apiProductSettlementModels.map(model => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </SelectField>
          <SelectField
            label='Result delivery'
            name='resultDelivery'
            defaultValue='direct_response'
            error={fieldErrors.resultDelivery}
            help='How buyers retrieve the usable result after the paid call.'
          >
            {apiProductResultDeliveries.map(delivery => (
              <option key={delivery} value={delivery}>
                {delivery}
              </option>
            ))}
          </SelectField>
          <Field
            label='Estimated latency'
            name='estimatedLatency'
            defaultValue='Depends on provider'
            error={fieldErrors.estimatedLatency}
            help='Human-readable time estimate shown on product pages.'
          />
          <Field
            label='Timeout seconds'
            name='timeoutSeconds'
            type='number'
            defaultValue='60'
            error={fieldErrors.timeoutSeconds}
            help='Maximum time the gateway waits for the upstream provider response.'
          />
        </div>
      </Card>

      <Card className='space-y-5'>
        <div>
          <SectionHeader
            eyebrow='Async polling'
            title='Job status mapping'
            docId='section-async-polling'
          />
          <p className='text-foreground/65 mt-2 text-sm leading-6'>
            Fill this only for async APIs that return a provider job ID. For
            long-running generation, rendering, data export, or enrichment jobs,
            import OpenAPI and the gateway fills the likely polling URL and JSON
            paths. Fast quote/read endpoints can stay synchronous and leave this
            section blank.
          </p>
        </div>
        <div className='grid gap-4 md:grid-cols-2'>
          <Field
            label='Status endpoint URL'
            name='statusEndpointUrl'
            type='url'
            defaultValue=''
            required={isAsyncProduct}
            error={fieldErrors.statusEndpointUrl}
            help='Polling URL for async jobs. Use {externalJobId} where the job ID belongs.'
          />
          <SelectField
            label='Status method'
            name='statusMethod'
            defaultValue='GET'
            required={isAsyncProduct}
            error={fieldErrors.statusMethod}
            help='HTTP method the gateway uses to poll the upstream job status.'
          >
            <option value='GET'>GET</option>
            <option value='POST'>POST</option>
          </SelectField>
          <Field
            label='External job ID path'
            name='externalJobIdPath'
            defaultValue='jobId'
            required={isAsyncProduct}
            error={fieldErrors.externalJobIdPath}
            help='Dot-path where the gateway finds the provider job ID in the first response.'
          />
          <Field
            label='Status path'
            name='statusPath'
            defaultValue='status'
            required={isAsyncProduct}
            error={fieldErrors.statusPath}
            help='Dot-path where the gateway reads completed, processing, or failed status.'
          />
          <Field
            label='Result URL path'
            name='resultUrlPath'
            defaultValue='resultUrl'
            required={false}
            error={fieldErrors.resultUrlPath}
            help='Dot-path where the gateway reads the final output URL when available.'
          />
          <Field
            label='Error message path'
            name='errorMessagePath'
            defaultValue='errorMessage'
            required={false}
            error={fieldErrors.errorMessagePath}
            help='Dot-path where the gateway reads provider error details.'
          />
        </div>
      </Card>

      <Card className='space-y-5'>
        <SectionHeader
          eyebrow='Schemas and examples'
          title='Request, response, and payload'
          docId='section-schemas'
        />
        <div className='grid gap-4 lg:grid-cols-3'>
          <JsonField
            label='Request schema'
            name='requestSchemaJson'
            defaultValue={emptyJsonObject}
            error={fieldErrors.requestSchemaJson}
            help='JSON object mapping request field names to simple type descriptions.'
          />
          <JsonField
            label='Response schema'
            name='responseSchemaJson'
            defaultValue={emptyJsonObject}
            error={fieldErrors.responseSchemaJson}
            help='JSON object mapping response field names to simple type descriptions.'
          />
          <JsonField
            label='Reference payload'
            name='referencePayloadJson'
            defaultValue={emptyJsonObject}
            error={fieldErrors.referencePayloadJson}
            help='Example JSON request shown to buyers and used by agent runs as a starting payload.'
          />
        </div>
      </Card>

      <Card className='space-y-5'>
        <SectionHeader
          eyebrow='Automation'
          title='Webhooks and agent availability'
          docId='section-automation'
        />
        <Field
          label='Webhook URL'
          name='webhookUrl'
          type='url'
          defaultValue=''
          required={false}
          error={fieldErrors.webhookUrl}
          help='Optional provider callback URL for future webhook coordination.'
        />

        <label className='border-foreground/10 flex items-start gap-3 rounded-lg border p-4 text-sm'>
          <input
            type='checkbox'
            name='isAgentReady'
            defaultChecked
            className='mt-1'
          />
          <span>
            <span className='flex flex-wrap items-center gap-2 font-semibold'>
              Make this listing available to autonomous agents
              <DocumentationLink docId='field-isAgentReady' label='Docs' />
            </span>
            <span className='text-foreground/65 mt-1 block leading-6'>
              Agent-ready products appear as selectable tools in the agent run
              builder after they are published.
            </span>
          </span>
        </label>
      </Card>

      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <Button type='submit' disabled={isSubmitting}>
          {isSubmitting ? 'Saving product' : 'Save API product'}
        </Button>
        {status ? (
          <p className='text-foreground/65 text-sm' role='status'>
            {status}
          </p>
        ) : null}
        {error ? (
          <p className='text-sm text-red-600' role='alert'>
            {error}
          </p>
        ) : null}
      </div>
    </form>
  )
}

function OpenApiImportPanel({
  onApply
}: {
  onApply: (candidate: OpenApiImportCandidate) => void
}) {
  const toastTimeoutRef = useRef<number | null>(null)
  const [specUrl, setSpecUrl] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [specText, setSpecText] = useState('')
  const [candidates, setCandidates] = useState<OpenApiImportCandidate[]>([])
  const [selectedOperationId, setSelectedOperationId] = useState('')
  const [selectedPollingId, setSelectedPollingId] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [toast, setToast] = useState<{
    description: string
    id: number
    title: string
  } | null>(null)

  const selectedCandidate =
    candidates.find(
      candidate => candidate.operationId === selectedOperationId
    ) ?? candidates[0]
  const selectedPollingCandidate =
    selectedCandidate?.pollingOptions.find(
      pollingOption => pollingOption.id === selectedPollingId
    ) ?? selectedCandidate?.pollingOptions[0]

  async function handleFile(file: File | undefined) {
    if (!file) {
      return
    }

    setSpecText(await file.text())
    setSpecUrl('')
  }

  async function handleImport() {
    setStatus('')
    setError('')
    setIsImporting(true)

    try {
      const response = await fetch('/api/providers/openapi/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specUrl, specText, baseUrl })
      })
      const data = (await response.json()) as {
        error?: string
        info?: { title: string; operationCount: number }
        candidates?: OpenApiImportCandidate[]
      }

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to import OpenAPI document.')
      }

      const nextCandidates = data.candidates ?? []
      setCandidates(nextCandidates)
      setSelectedOperationId(nextCandidates[0]?.operationId ?? '')
      setSelectedPollingId(nextCandidates[0]?.pollingOptions[0]?.id ?? '')
      const importedMessage = `Imported ${nextCandidates.length} operation${nextCandidates.length === 1 ? '' : 's'} from ${data.info?.title ?? 'OpenAPI'}.`
      setStatus(importedMessage)
      showToast(
        'OpenAPI import complete',
        `${importedMessage} Choose an operation, then fill the listing.`
      )
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to import OpenAPI document.'
      )
    } finally {
      setIsImporting(false)
    }
  }

  function handleApplySelectedCandidate() {
    if (!selectedCandidate) {
      return
    }

    const filledCandidate = withSelectedPolling(
      selectedCandidate,
      selectedPollingCandidate
    )
    onApply(filledCandidate)
    showToast(
      'Listing fields filled',
      `${filledCandidate.name} has been applied. Review pricing, auth secret, and validation fields before publishing.`
    )
  }

  function showToast(title: string, description: string) {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current)
    }

    setToast({
      description,
      id: Date.now(),
      title
    })

    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null)
    }, 6000)
  }

  return (
    <Card className='space-y-6'>
      <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
        <div className='max-w-4xl'>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Fast setup
          </p>
          <h2 className='font-display mt-2 text-2xl'>Import OpenAPI</h2>
          <p className='text-foreground/65 mt-2 text-sm leading-6'>
            Paste an OpenAPI JSON/YAML URL or upload a spec file. the gateway
            reads the operations, detects auth and async jobs, links
            job-creation endpoints to status endpoints, then fills the listing
            fields for the selected endpoint.
          </p>
        </div>
        <DocumentationLink docId='section-openapi-import' label='Open docs' />
      </div>

      <div className='border-border/70 bg-background/40 space-y-4 rounded-lg border p-4'>
        <div className='flex items-center gap-3'>
          <span className='bg-primary text-primary-foreground inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold'>
            1
          </span>
          <div>
            <h3 className='font-semibold'>Import source</h3>
            <p className='text-foreground/60 text-sm'>
              Use a hosted spec URL or upload a local OpenAPI file.
            </p>
          </div>
        </div>
        <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end'>
          <Field
            label='OpenAPI URL'
            name='openApiUrlPreview'
            type='url'
            defaultValue=''
            required={false}
            help='Public URL to the provider OpenAPI JSON or YAML document.'
            value={specUrl}
            onChange={setSpecUrl}
          />
          <Field
            label='Override server URL'
            name='openApiBaseUrlPreview'
            type='url'
            defaultValue=''
            required={false}
            help='Optional base URL when the OpenAPI servers value is relative or points to staging.'
            value={baseUrl}
            onChange={setBaseUrl}
          />
          <Button
            type='button'
            className='w-full lg:w-auto'
            onClick={handleImport}
            disabled={isImporting}
          >
            {isImporting ? 'Importing' : 'Import spec'}
          </Button>
        </div>
        <div className='block max-w-2xl space-y-2'>
          <HelpLabel
            label='Upload OpenAPI file'
            required={false}
            help='Use this when the provider spec is local instead of hosted at a URL.'
            docId='field-openApiFile'
            htmlFor='openApiFile'
          />
          <Input
            id='openApiFile'
            type='file'
            accept='.json,.yaml,.yml,application/json,text/yaml,application/yaml'
            className='file:bg-muted file:text-foreground hover:file:bg-accent/10 flex h-16 cursor-pointer items-center py-0 leading-[4rem] file:mr-4 file:h-9 file:rounded-md file:border-0 file:px-4 file:text-sm file:font-semibold'
            onChange={event => handleFile(event.target.files?.[0])}
          />
        </div>
      </div>

      <div className='border-border/70 bg-background/40 space-y-4 rounded-lg border p-4'>
        <div className='flex items-center gap-3'>
          <span className='bg-primary text-primary-foreground inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold'>
            2
          </span>
          <div>
            <h3 className='font-semibold'>Choose operation mapping</h3>
            <p className='text-foreground/60 text-sm'>
              Select the paid endpoint, then select the status endpoint for
              async jobs.
            </p>
          </div>
        </div>
        <div className='grid min-w-0 gap-4 xl:grid-cols-2'>
          <SelectField
            label='Imported operation'
            name='openApiOperationPreview'
            defaultValue={selectedOperationId}
            required={false}
            help='Choose which imported endpoint should become this paid marketplace listing.'
            value={selectedOperationId}
            onChange={value => {
              setSelectedOperationId(value)
              const nextCandidate = candidates.find(
                candidate => candidate.operationId === value
              )
              setSelectedPollingId(nextCandidate?.pollingOptions[0]?.id ?? '')
            }}
          >
            {candidates.length === 0 ? (
              <option value=''>Import a spec first</option>
            ) : null}
            {candidates.map(candidate => (
              <option key={candidate.operationId} value={candidate.operationId}>
                {candidate.label} - {candidate.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label='Job status endpoint'
            name='openApiPollingPreview'
            defaultValue={selectedPollingCandidate?.id ?? ''}
            required={false}
            disabled={!selectedCandidate?.pollingOptions.length}
            help='For async operations, choose the imported OpenAPI endpoint the gateway should poll with the job ID returned by the selected operation.'
            value={selectedPollingCandidate?.id ?? ''}
            onChange={setSelectedPollingId}
          >
            {selectedCandidate?.pollingOptions.length ? null : (
              <option value=''>No status endpoint detected</option>
            )}
            {selectedCandidate?.pollingOptions.map(pollingOption => (
              <option key={pollingOption.id} value={pollingOption.id}>
                {pollingOption.label}
              </option>
            ))}
          </SelectField>
        </div>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
          <Button
            type='button'
            variant='outline'
            className='w-full sm:w-auto'
            disabled={!selectedCandidate}
            onClick={handleApplySelectedCandidate}
          >
            Fill listing
          </Button>
          {selectedPollingCandidate ? (
            <p className='text-foreground/60 min-w-0 text-sm'>
              Polls{' '}
              <span className='text-foreground font-mono break-all'>
                {selectedPollingCandidate.method}{' '}
                {selectedPollingCandidate.path}
              </span>
            </p>
          ) : null}
        </div>
      </div>
      {status ? (
        <p className='text-foreground/65 text-sm' role='status'>
          {status}
        </p>
      ) : null}
      {error ? (
        <p className='text-sm text-red-600' role='alert'>
          {error}
        </p>
      ) : null}
      <ScreenToast toast={toast} onDismiss={() => setToast(null)} />
    </Card>
  )
}

function ScreenToast({
  toast,
  onDismiss
}: {
  toast: { description: string; id: number; title: string } | null
  onDismiss: () => void
}) {
  if (!toast || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      key={toast.id}
      role='status'
      aria-live='polite'
      className='border-border bg-card text-card-foreground fixed right-4 bottom-4 z-[100] w-[calc(100vw-2rem)] max-w-md rounded-lg border p-4 shadow-2xl shadow-black/20'
    >
      <div className='flex gap-3'>
        <div className='bg-primary/10 text-primary mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg'>
          <CheckCircle2 className='h-5 w-5' aria-hidden />
        </div>
        <div className='min-w-0 flex-1'>
          <p className='text-sm font-semibold'>{toast.title}</p>
          <p className='text-muted-foreground mt-1 text-sm leading-6'>
            {toast.description}
          </p>
        </div>
        <button
          type='button'
          onClick={onDismiss}
          aria-label='Dismiss notification'
          className='text-muted-foreground hover:text-foreground focus-ring -m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition'
        >
          <X className='h-4 w-4' aria-hidden />
        </button>
      </div>
    </div>,
    document.body
  )
}

function withSelectedPolling(
  candidate: OpenApiImportCandidate,
  pollingOption?: OpenApiPollingCandidate
): OpenApiImportCandidate {
  if (!pollingOption) {
    return candidate
  }

  return {
    ...candidate,
    statusEndpointUrl: pollingOption.statusEndpointUrl,
    statusMethod: pollingOption.method,
    statusPath: pollingOption.statusPath,
    resultUrlPath: pollingOption.resultUrlPath,
    errorMessagePath: pollingOption.errorMessagePath
  }
}

function Field({
  label,
  name,
  defaultValue,
  type = 'text',
  step,
  required = true,
  help,
  error,
  value,
  onChange
}: {
  label: string
  name: string
  defaultValue: string
  type?: string
  step?: string
  required?: boolean
  help: string
  error?: string
  value?: string
  onChange?: (value: string) => void
}) {
  const errorId = `${name}-error`
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const isPasswordField = type === 'password'
  const inputType =
    isPasswordField && isPasswordVisible
      ? 'text'
      : isPasswordField
        ? 'password'
        : type

  return (
    <div className='space-y-2'>
      <HelpLabel
        label={label}
        help={help}
        required={required}
        docId={`field-${name}`}
        htmlFor={name}
      />
      <span className='relative block'>
        <Input
          id={name}
          name={name}
          type={inputType}
          step={step}
          defaultValue={onChange ? undefined : defaultValue}
          value={onChange ? value : undefined}
          onChange={
            onChange ? event => onChange(event.currentTarget.value) : undefined
          }
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            isPasswordField && 'pr-12',
            error && 'border-red-500 focus-visible:ring-red-500'
          )}
        />
        {isPasswordField ? (
          <button
            type='button'
            className='text-foreground/60 hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background absolute top-1/2 right-2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
            aria-label={isPasswordVisible ? 'Hide secret' : 'Show secret'}
            aria-pressed={isPasswordVisible}
            onClick={() => setIsPasswordVisible(current => !current)}
          >
            {isPasswordVisible ? (
              <EyeOff className='h-4 w-4' aria-hidden />
            ) : (
              <Eye className='h-4 w-4' aria-hidden />
            )}
          </button>
        ) : null}
      </span>
      {error ? (
        <p id={errorId} className='text-sm font-medium text-red-500'>
          {error}
        </p>
      ) : null}
    </div>
  )
}

function SelectField({
  label,
  name,
  defaultValue,
  children,
  help,
  required = true,
  disabled = false,
  error,
  value,
  onChange
}: {
  label: string
  name: string
  defaultValue: string
  children: ReactNode
  help: string
  required?: boolean
  disabled?: boolean
  error?: string
  value?: string
  onChange?: (value: string) => void
}) {
  const errorId = `${name}-error`

  return (
    <div className='space-y-2'>
      <HelpLabel
        label={label}
        help={help}
        required={required}
        docId={`field-${name}`}
        htmlFor={name}
      />
      <select
        id={name}
        name={name}
        defaultValue={onChange ? undefined : defaultValue}
        value={onChange ? value : undefined}
        onChange={
          onChange ? event => onChange(event.currentTarget.value) : undefined
        }
        required={required}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'border-foreground/15 bg-background text-foreground focus-visible:ring-foreground/30 h-11 w-full min-w-0 rounded-2xl border px-4 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
          error && 'border-red-500 focus-visible:ring-red-500'
        )}
      >
        {children}
      </select>
      {error ? (
        <p id={errorId} className='text-sm font-medium text-red-500'>
          {error}
        </p>
      ) : null}
    </div>
  )
}

function JsonField({
  label,
  name,
  defaultValue,
  help,
  error
}: {
  label: string
  name: string
  defaultValue: string
  help: string
  error?: string
}) {
  const errorId = `${name}-error`

  return (
    <div className='space-y-2'>
      <HelpLabel
        label={label}
        help={help}
        required={false}
        docId={`field-${name}`}
        htmlFor={name}
      />
      <textarea
        id={name}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'border-foreground/15 bg-background text-foreground focus-visible:ring-foreground/30 min-h-56 w-full rounded-2xl border px-4 py-3 font-mono text-xs leading-6 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          error && 'border-red-500 focus-visible:ring-red-500'
        )}
      />
      {error ? (
        <p id={errorId} className='text-sm font-medium text-red-500'>
          {error}
        </p>
      ) : null}
    </div>
  )
}

function JsonTextField({
  label,
  name,
  defaultValue,
  help,
  minHeight,
  required = false,
  error
}: {
  label: string
  name: string
  defaultValue: string
  help: string
  minHeight: string
  required?: boolean
  error?: string
}) {
  const errorId = `${name}-error`

  return (
    <div className='space-y-2'>
      <HelpLabel
        label={label}
        help={help}
        required={required}
        docId={`field-${name}`}
        htmlFor={name}
      />
      <textarea
        id={name}
        name={name}
        defaultValue={defaultValue}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'border-foreground/15 bg-background text-foreground placeholder:text-foreground/50 focus-visible:ring-foreground/30 w-full rounded-2xl border px-4 py-3 text-sm leading-6 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          minHeight,
          error && 'border-red-500 focus-visible:ring-red-500'
        )}
      />
      {error ? (
        <p id={errorId} className='text-sm font-medium text-red-500'>
          {error}
        </p>
      ) : null}
    </div>
  )
}

function HelpLabel({
  label,
  help,
  required = true,
  docId,
  htmlFor
}: {
  label: string
  help: string
  required?: boolean
  docId: string
  htmlFor: string
}) {
  return (
    <span className='flex items-center justify-between gap-3'>
      <label
        htmlFor={htmlFor}
        className='text-foreground/60 flex min-w-0 items-center gap-2 text-xs tracking-[0.16em] uppercase'
      >
        {label}
        {required ? (
          <span className='text-red-500' aria-label='required'>
            *
          </span>
        ) : null}
      </label>
      <DocumentationLink docId={docId} label='Docs' title={help} />
    </span>
  )
}

function SectionHeader({
  eyebrow,
  title,
  docId
}: {
  eyebrow: string
  title: string
  docId: string
}) {
  return (
    <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
      <div>
        <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
          {eyebrow}
        </p>
        <h2 className='font-display mt-2 text-2xl'>{title}</h2>
      </div>
      <DocumentationLink docId={docId} label='Open docs' />
    </div>
  )
}

function DocumentationLink({
  docId,
  label,
  title
}: {
  docId: string
  label: string
  title?: string
}) {
  return (
    <a
      href={`/developers/docs#${docId}`}
      title={title}
      target='_blank'
      rel='noreferrer'
      className='border-border bg-background/80 text-foreground/75 hover:border-primary/50 hover:text-primary focus-visible:ring-ring focus-visible:ring-offset-background inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-normal normal-case transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
    >
      <BookOpen className='h-3.5 w-3.5' aria-hidden />
      {label}
    </a>
  )
}

function setFormValue(form: HTMLFormElement, name: string, value: string) {
  const field = form.elements.namedItem(name)

  if (
    field instanceof HTMLInputElement ||
    field instanceof HTMLTextAreaElement ||
    field instanceof HTMLSelectElement
  ) {
    field.value = value
    field.dispatchEvent(new Event('input', { bubbles: true }))
    field.dispatchEvent(new Event('change', { bubbles: true }))
  }
}

function flattenFieldErrors(fieldErrors: Record<string, string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .map(([name, errors]) => [name, errors?.[0] ?? ''])
      .filter(([, message]) => message)
  ) as FieldErrors
}

function focusFirstInvalidField(form: HTMLFormElement, fieldNames: string[]) {
  const firstInvalidField = fieldNames
    .map(name => form.elements.namedItem(name))
    .find(
      field =>
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement ||
        field instanceof HTMLSelectElement
    )

  if (
    firstInvalidField instanceof HTMLInputElement ||
    firstInvalidField instanceof HTMLTextAreaElement ||
    firstInvalidField instanceof HTMLSelectElement
  ) {
    firstInvalidField.focus()
    firstInvalidField.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })
  }
}
