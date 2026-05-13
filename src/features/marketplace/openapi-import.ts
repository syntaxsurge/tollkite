import { parse as parseYaml } from 'yaml'

import type {
  ApiProductCategory,
  ApiProductExecutionMode,
  ApiProductResultDelivery,
  ApiProductSettlementModel
} from '@/features/marketplace/products'

export type OpenApiImportCandidate = {
  operationId: string
  label: string
  name: string
  slug: string
  category: ApiProductCategory
  method: 'GET' | 'POST'
  endpointUrl: string
  pricingModel: 'fixed' | 'credit_metered'
  pricingQuoteEndpointUrl: string
  pricingQuoteMethod: 'GET' | 'POST'
  pricingCreditUnitPath: string
  pricingUsageCreditPath: string
  pricingCreditToUsdtRate: string
  pricingMultiplier: string
  pricingMinimumChargeUsd: string
  pricingMaximumChargeUsd: string
  authType: 'none' | 'bearer' | 'api_key_header' | 'api_key_query'
  authRequired: boolean
  authHeaderName: string
  authQueryParam: string
  executionMode: ApiProductExecutionMode
  settlementModel: ApiProductSettlementModel
  resultDelivery: ApiProductResultDelivery
  estimatedLatency: string
  statusEndpointUrl: string
  statusMethod: 'GET' | 'POST'
  externalJobIdPath: string
  statusPath: string
  resultUrlPath: string
  errorMessagePath: string
  pollingOptions: OpenApiPollingCandidate[]
  requestSchema: Record<string, string>
  responseSchema: Record<string, string>
  referencePayload: Record<string, unknown>
}

export type OpenApiPollingCandidate = {
  id: string
  label: string
  method: 'GET' | 'POST'
  path: string
  statusEndpointUrl: string
  statusPath: string
  resultUrlPath: string
  errorMessagePath: string
}

type OpenApiDocument = {
  openapi?: string
  swagger?: string
  info?: {
    title?: string
  }
  servers?: { url?: string }[]
  security?: Record<string, unknown[]>[]
  paths?: Record<string, Record<string, OpenApiOperation>>
  components?: {
    schemas?: Record<string, unknown>
    securitySchemes?: Record<
      string,
      {
        type?: string
        scheme?: string
        in?: string
        name?: string
      }
    >
  }
}

type OpenApiOperation = {
  operationId?: string
  summary?: string
  description?: string
  tags?: string[]
  security?: Record<string, unknown[]>[]
  parameters?: {
    in?: string
    name?: string
    required?: boolean
    schema?: unknown
  }[]
  requestBody?: {
    content?: Record<string, { schema?: unknown; example?: unknown }>
  }
  responses?: Record<
    string,
    {
      content?: Record<string, { schema?: unknown; example?: unknown }>
    }
  >
}

const httpMethods = ['get', 'post'] as const

export function parseOpenApiDocument(input: string) {
  const trimmed = input.trim()

  if (!trimmed) {
    throw new Error('OpenAPI document is empty.')
  }

  return (
    trimmed.startsWith('{') || trimmed.startsWith('[')
      ? JSON.parse(trimmed)
      : parseYaml(trimmed)
  ) as OpenApiDocument
}

export function createOpenApiImportCandidates({
  document,
  sourceUrl,
  baseUrl
}: {
  document: OpenApiDocument
  sourceUrl?: string
  baseUrl?: string
}) {
  if (!document.paths) {
    throw new Error('OpenAPI document does not include a paths object.')
  }

  const resolvedBaseUrl = resolveBaseUrl({
    document,
    sourceUrl,
    baseUrl
  })
  const operations = Object.entries(document.paths).flatMap(
    ([path, pathItem]) =>
      httpMethods.flatMap(method => {
        const operation = pathItem[method]

        if (!operation) {
          return []
        }

        return [
          buildCandidate({
            document,
            operation,
            path,
            method: method.toUpperCase() as 'GET' | 'POST',
            baseUrl: resolvedBaseUrl
          })
        ]
      })
  )

  return operations
}

function buildCandidate({
  document,
  operation,
  path,
  method,
  baseUrl
}: {
  document: OpenApiDocument
  operation: OpenApiOperation
  path: string
  method: 'GET' | 'POST'
  baseUrl: string
}): OpenApiImportCandidate {
  const name = operation.summary || operation.operationId || titleize(path)
  const responseStatus = pickResponseStatus(operation)
  const responseSchema = getResponseSchema(document, operation, responseStatus)
  const requestSchema = getRequestSchema(document, operation)
  const schemaFields = schemaToFieldMap(requestSchema)
  const responseFields = schemaToFieldMap(responseSchema)
  const acceptedAsync = responseStatus === '202'
  const jobIdPath = pickFirstField(responseFields, [
    'jobId',
    'mediaJobId',
    'renderId',
    'transcriptionId',
    'voiceoverId',
    'id'
  ])
  const statusPath = pickFirstField(responseFields, ['status', 'state'])
  const resultUrlPath = pickFirstField(responseFields, [
    'resultUrl',
    'renderUrl',
    'previewUrl',
    'url',
    'outputUrl'
  ])
  const pollingOptions = acceptedAsync
    ? createPollingCandidates({
        document,
        baseUrl,
        createPath: path,
        createMethod: method,
        externalJobIdPath: jobIdPath
      })
    : []
  const defaultPollingOption = pollingOptions[0]
  const auth = inferAuth(document, operation)
  const creditUnitPath = pickFirstField(responseFields, [
    'estimatedCredits',
    'credits',
    'creditAmount',
    'usage.credits',
    'billing.credits'
  ])
  const usageCreditPath = pickFirstField(responseFields, [
    'chargedCredits',
    'actualCredits',
    'usage.chargedCredits',
    'billing.chargedCredits'
  ])
  const quotePath = creditUnitPath ? findQuotePath(document, path) : ''

  return {
    operationId: operation.operationId || `${method.toLowerCase()}-${path}`,
    label: `${method} ${path}`,
    name,
    slug: slugify(name),
    category: inferCategory(operation, path),
    method,
    endpointUrl: joinUrl(baseUrl, path),
    pricingModel: creditUnitPath ? 'credit_metered' : 'fixed',
    pricingQuoteEndpointUrl: quotePath ? joinUrl(baseUrl, quotePath) : '',
    pricingQuoteMethod: 'POST',
    pricingCreditUnitPath: creditUnitPath,
    pricingUsageCreditPath: usageCreditPath,
    pricingCreditToUsdtRate: '0.01',
    pricingMultiplier: '1',
    pricingMinimumChargeUsd: '0',
    pricingMaximumChargeUsd: '',
    authType: auth.type,
    authRequired: auth.required,
    authHeaderName:
      auth.type === 'api_key_header'
        ? auth.security?.name || 'Authorization'
        : 'Authorization',
    authQueryParam:
      auth.type === 'api_key_query' ? auth.security?.name || '' : '',
    executionMode: acceptedAsync ? 'asynchronous' : 'synchronous',
    settlementModel: acceptedAsync
      ? 'pay_on_job_acceptance'
      : 'pay_on_successful_response',
    resultDelivery: acceptedAsync ? 'poll_or_webhook' : 'direct_response',
    estimatedLatency: acceptedAsync
      ? 'Async provider job'
      : 'Provider response',
    statusEndpointUrl: defaultPollingOption?.statusEndpointUrl ?? '',
    statusMethod: defaultPollingOption?.method ?? 'GET',
    externalJobIdPath: jobIdPath,
    statusPath: defaultPollingOption?.statusPath ?? statusPath,
    resultUrlPath: defaultPollingOption?.resultUrlPath ?? resultUrlPath,
    errorMessagePath:
      defaultPollingOption?.errorMessagePath ??
      pickFirstField(responseFields, ['errorMessage', 'message', 'error']),
    pollingOptions,
    requestSchema: schemaFields,
    responseSchema: responseFields,
    referencePayload: schemaToExamplePayload(requestSchema)
  }
}

function createPollingCandidates({
  document,
  baseUrl,
  createPath,
  createMethod,
  externalJobIdPath
}: {
  document: OpenApiDocument
  baseUrl: string
  createPath: string
  createMethod: 'GET' | 'POST'
  externalJobIdPath: string
}) {
  if (!document.paths || !externalJobIdPath) {
    return []
  }

  const createTokens = pathTokens(createPath)

  return Object.entries(document.paths)
    .flatMap(([path, pathItem]) =>
      httpMethods.flatMap(method => {
        const operation = pathItem[method]

        if (!operation || !path.includes('{')) {
          return []
        }

        const methodName = method.toUpperCase() as 'GET' | 'POST'
        const operationText =
          `${path} ${operation.summary ?? ''} ${operation.operationId ?? ''}`.toLowerCase()

        if (path === createPath && methodName === createMethod) {
          return []
        }

        if (
          methodName !== 'GET' &&
          !operationText.includes('status') &&
          !operationText.includes('get')
        ) {
          return []
        }

        const responseSchema = getResponseSchema(
          document,
          operation,
          pickResponseStatus(operation)
        )
        const responseFields = schemaToFieldMap(responseSchema)
        const pathParamName = getPathParamName(operation, path)
        const score = scorePollingCandidate({
          createPath,
          createTokens,
          method: methodName,
          candidatePath: path,
          candidateOperation: operation,
          externalJobIdPath,
          pathParamName,
          responseFields
        })

        if (score < 3) {
          return []
        }

        return [
          {
            score,
            candidate: {
              id: `${methodName}:${path}`,
              label: `${methodName} ${path} - ${
                operation.summary || operation.operationId || 'Status endpoint'
              }`,
              method: methodName,
              path,
              statusEndpointUrl: replacePathParam(
                joinUrl(baseUrl, path),
                pathParamName
              ),
              statusPath: pickFirstField(responseFields, [
                'status',
                'state',
                'job.status',
                'data.status'
              ]),
              resultUrlPath: pickFirstField(responseFields, [
                'resultUrl',
                'renderUrl',
                'previewUrl',
                'url',
                'outputUrl',
                'result.url',
                'data.resultUrl',
                'data.url'
              ]),
              errorMessagePath: pickFirstField(responseFields, [
                'errorMessage',
                'message',
                'error.message',
                'error',
                'data.errorMessage'
              ])
            } satisfies OpenApiPollingCandidate
          }
        ]
      })
    )
    .sort((left, right) => right.score - left.score)
    .map(({ candidate }) => candidate)
}

function scorePollingCandidate({
  createPath,
  createTokens,
  method,
  candidatePath,
  candidateOperation,
  externalJobIdPath,
  pathParamName,
  responseFields
}: {
  createPath: string
  createTokens: string[]
  method: 'GET' | 'POST'
  candidatePath: string
  candidateOperation: OpenApiOperation
  externalJobIdPath: string
  pathParamName: string
  responseFields: Record<string, string>
}) {
  const candidateTokens = pathTokens(candidatePath)
  const candidateText =
    `${candidatePath} ${candidateOperation.summary ?? ''} ${candidateOperation.operationId ?? ''}`.toLowerCase()
  const statusPath = pickFirstField(responseFields, [
    'status',
    'state',
    'job.status',
    'data.status'
  ])
  let score = 0

  if (candidatePath.startsWith(createPath.replace(/\/$/, ''))) {
    score += 6
  }

  if (pathParamName && similarName(pathParamName, externalJobIdPath)) {
    score += 5
  }

  if (statusPath) {
    score += 4
  }

  if (candidateText.includes('status') || candidateText.includes('get')) {
    score += 2
  }

  if (method === 'GET') {
    score += 2
  }

  if (candidateTokens.some(token => createTokens.includes(token))) {
    score += 2
  }

  if (candidateText.includes('job')) {
    score += 1
  }

  return score
}

function resolveBaseUrl({
  document,
  sourceUrl,
  baseUrl
}: {
  document: OpenApiDocument
  sourceUrl?: string
  baseUrl?: string
}) {
  const serverUrl = baseUrl || document.servers?.[0]?.url || ''

  if (/^https?:\/\//i.test(serverUrl)) {
    const normalizedServerUrl = serverUrl.replace(/\/$/, '')

    return recoverVersionedApiBaseUrl({
      document,
      serverUrl: normalizedServerUrl,
      sourceUrl
    })
  }

  if (sourceUrl && /^https?:\/\//i.test(sourceUrl)) {
    const origin = new URL(sourceUrl).origin

    return new URL(serverUrl || '/', origin).toString().replace(/\/$/, '')
  }

  return serverUrl.replace(/\/$/, '')
}

function recoverVersionedApiBaseUrl({
  document,
  serverUrl,
  sourceUrl
}: {
  document: OpenApiDocument
  serverUrl: string
  sourceUrl?: string
}) {
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
    return serverUrl
  }

  const server = new URL(serverUrl)
  const source = new URL(sourceUrl)

  if (server.origin !== source.origin || server.pathname !== '/') {
    return serverUrl
  }

  const inferredBasePath = source.pathname.replace(
    /\/(?:openapi|swagger)(?:\.(?:json|ya?ml))?$/i,
    ''
  )

  if (!inferredBasePath || inferredBasePath === source.pathname) {
    return serverUrl
  }

  const hasRootPaths = Object.keys(document.paths ?? {}).some(path =>
    path.startsWith(inferredBasePath)
  )

  if (hasRootPaths) {
    return serverUrl
  }

  return `${source.origin}${inferredBasePath}`.replace(/\/$/, '')
}

function inferAuth(document: OpenApiDocument, operation: OpenApiOperation) {
  const securityRequirement =
    (operation.security ?? document.security ?? []).find(
      requirement => Object.keys(requirement).length > 0
    ) ?? {}
  const securityName = Object.keys(securityRequirement)[0]
  const security = securityName
    ? document.components?.securitySchemes?.[securityName]
    : undefined

  if (security?.type === 'http' && security.scheme === 'bearer') {
    return { type: 'bearer' as const, required: true, security }
  }

  if (security?.type === 'apiKey' && security.in === 'query') {
    return { type: 'api_key_query' as const, required: true, security }
  }

  if (security?.type === 'apiKey') {
    return { type: 'api_key_header' as const, required: true, security }
  }

  return { type: 'none' as const, required: false, security }
}

function inferCategory(
  operation: OpenApiOperation,
  path: string
): ApiProductCategory {
  const text =
    `${operation.tags?.join(' ') ?? ''} ${operation.summary ?? ''} ${path}`.toLowerCase()

  if (
    text.includes('video') ||
    text.includes('media') ||
    text.includes('image')
  ) {
    return 'media'
  }

  if (text.includes('agent') || text.includes('workflow')) {
    return 'agent'
  }

  if (text.includes('billing') || text.includes('commerce')) {
    return 'commerce'
  }

  if (text.includes('usage') || text.includes('data')) {
    return 'data'
  }

  return 'developer'
}

function getRequestSchema(
  document: OpenApiDocument,
  operation: OpenApiOperation
) {
  return resolveSchema(
    document,
    operation.requestBody?.content?.['application/json']?.schema
  )
}

function getResponseSchema(
  document: OpenApiDocument,
  operation: OpenApiOperation,
  status: string
) {
  return resolveSchema(
    document,
    operation.responses?.[status]?.content?.['application/json']?.schema
  )
}

function pickResponseStatus(operation: OpenApiOperation) {
  return (
    ['202', '201', '200'].find(status => operation.responses?.[status]) ??
    Object.keys(operation.responses ?? {})[0] ??
    '200'
  )
}

function resolveSchema(document: OpenApiDocument, schema: unknown): unknown {
  if (!schema || typeof schema !== 'object') {
    return schema
  }

  const ref = (schema as { $ref?: string }).$ref

  if (ref?.startsWith('#/components/schemas/')) {
    const name = ref.replace('#/components/schemas/', '')

    return resolveSchema(document, document.components?.schemas?.[name])
  }

  return schema
}

function schemaToFieldMap(schema: unknown) {
  const properties = readSchemaProperties(schema)

  if (!properties) {
    return {}
  }

  return flattenSchemaFields(properties, '', readRequiredFields(schema))
}

function flattenSchemaFields(
  properties: Record<string, unknown>,
  prefix = '',
  requiredFields = new Set<string>()
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(properties).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key
      const nestedProperties = readSchemaProperties(value)
      const nestedRequiredFields = readRequiredFields(value)
      const field = [
        [path, describeSchemaField(value, requiredFields.has(key))]
      ]

      if (!nestedProperties) {
        return field
      }

      return [
        ...field,
        ...Object.entries(
          flattenSchemaFields(nestedProperties, path, nestedRequiredFields)
        )
      ]
    })
  )
}

function schemaToExamplePayload(schema: unknown) {
  const properties = readSchemaProperties(schema)

  if (!properties) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [
      key,
      exampleValueForSchema(value)
    ])
  )
}

function readSchemaProperties(schema: unknown) {
  if (!schema || typeof schema !== 'object') {
    return null
  }

  return (schema as { properties?: Record<string, unknown> }).properties ?? null
}

function readRequiredFields(schema: unknown) {
  if (!schema || typeof schema !== 'object') {
    return new Set<string>()
  }

  const required = (schema as { required?: unknown }).required

  if (!Array.isArray(required)) {
    return new Set<string>()
  }

  return new Set(
    required.filter((field): field is string => typeof field === 'string')
  )
}

function describeSchemaField(schema: unknown, required: boolean): string {
  if (!schema || typeof schema !== 'object') {
    return required ? 'unknown (required)' : 'unknown (optional)'
  }

  const resolvedSchema = pickDisplaySchemaVariant(schema)
  const field = schema as {
    type?: string | string[]
    enum?: unknown[]
    format?: string
    description?: string
    externalDocs?: { url?: string }
    items?: { type?: string | string[]; enum?: unknown[] }
    nullable?: boolean
  }
  const displayField = resolvedSchema as {
    type?: string | string[]
    enum?: unknown[]
    format?: string
    items?: { type?: string | string[]; enum?: unknown[] }
  }

  const requirement = required ? 'required' : 'optional'
  const help = [field.description, field.externalDocs?.url]
    .filter((value): value is string => Boolean(value))
    .join(' ')
  const withHelp = (label: string) => (help ? `${label} — ${help}` : label)

  if (displayField.enum?.length) {
    return withHelp(
      `${displayField.enum.map(item => JSON.stringify(item)).join(' | ')} (${requirement})`
    )
  }

  if (normalizeSchemaType(displayField.type) === 'array') {
    const itemLabel = displayField.items?.enum?.length
      ? displayField.items.enum.map(item => JSON.stringify(item)).join(' | ')
      : (normalizeSchemaType(displayField.items?.type) ?? 'unknown')

    return withHelp(`array<${itemLabel}> (${requirement})`)
  }

  return withHelp(
    `${[normalizeSchemaType(displayField.type) ?? 'object', displayField.format]
      .filter(Boolean)
      .join(':')} (${requirement})`
  )
}

function exampleValueForSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== 'object') {
    return ''
  }

  const selectedSchema = pickExampleSchemaVariant(schema)
  const field = selectedSchema as {
    example?: unknown
    default?: unknown
    enum?: unknown[]
    const?: unknown
    type?: string | string[]
    items?: unknown
  }

  if (field.example !== undefined) {
    return field.example
  }

  if (field.default !== undefined) {
    return field.default
  }

  if (field.enum?.length) {
    return field.enum[0]
  }

  if (field.const !== undefined) {
    return field.const
  }

  const type = normalizeSchemaType(field.type)

  if (type === 'number' || type === 'integer') {
    return 1
  }

  if (type === 'boolean') {
    return true
  }

  if (type === 'array') {
    return []
  }

  return ''
}

function pickDisplaySchemaVariant(schema: unknown): unknown {
  const variants = readSchemaVariants(schema)

  if (!variants.length) {
    return schema
  }

  return (
    variants.find(variant => {
      const type = normalizeSchemaType((variant as { type?: unknown }).type)

      return type && type !== 'null'
    }) ?? variants[0]
  )
}

function pickExampleSchemaVariant(schema: unknown): unknown {
  const variants = readSchemaVariants(schema)

  if (!variants.length) {
    return schema
  }

  return (
    variants.find(variant => {
      const field = variant as {
        default?: unknown
        example?: unknown
        const?: unknown
        enum?: unknown[]
      }

      return (
        field.default !== undefined ||
        field.example !== undefined ||
        field.const !== undefined ||
        Boolean(field.enum?.length)
      )
    }) ?? pickDisplaySchemaVariant(schema)
  )
}

function readSchemaVariants(schema: unknown) {
  if (!schema || typeof schema !== 'object') {
    return []
  }

  const variants =
    (schema as { anyOf?: unknown[]; oneOf?: unknown[] }).anyOf ??
    (schema as { anyOf?: unknown[]; oneOf?: unknown[] }).oneOf

  return Array.isArray(variants)
    ? variants.filter(
        (variant): variant is Record<string, unknown> =>
          Boolean(variant) && typeof variant === 'object'
      )
    : []
}

function normalizeSchemaType(type: unknown) {
  if (Array.isArray(type)) {
    return type.find(
      (item): item is string => typeof item === 'string' && item !== 'null'
    )
  }

  return typeof type === 'string' ? type : undefined
}

function pickFirstField(fields: Record<string, string>, names: string[]) {
  const keys = Object.keys(fields)

  return names.find(name => keys.includes(name)) ?? ''
}

function findQuotePath(document: OpenApiDocument, createPath: string) {
  if (!document.paths) {
    return ''
  }

  const createTokens = pathTokens(createPath)
  const quoteCandidates = Object.entries(document.paths)
    .flatMap(([path, pathItem]) => {
      const operation = pathItem.post ?? pathItem.get

      if (!operation || !path.toLowerCase().includes('quote')) {
        return []
      }

      const quoteTokens = pathTokens(path)
      const text = `${path} ${operation.summary ?? ''}`.toLowerCase()
      const score =
        quoteTokens.filter(token => createTokens.includes(token)).length * 2 +
        (text.includes('video') && createPath.includes('video') ? 3 : 0) +
        (text.includes('image') && createPath.includes('image') ? 3 : 0) +
        (text.includes('render') && createPath.includes('render') ? 3 : 0) +
        (text.includes('regeneration') && createPath.includes('regenerate')
          ? 3
          : 0)

      return [{ path, score }]
    })
    .sort((left, right) => right.score - left.score)

  return quoteCandidates[0]?.path ?? ''
}

function getPathParamName(operation: OpenApiOperation, path: string) {
  const explicitParam = operation.parameters?.find(
    parameter => parameter.in === 'path' && parameter.name
  )?.name

  if (explicitParam) {
    return explicitParam
  }

  return path.match(/\{([^}]+)\}/)?.[1] ?? ''
}

function replacePathParam(url: string, pathParamName: string) {
  if (pathParamName) {
    return url.replace(`{${pathParamName}}`, '{externalJobId}')
  }

  return url.replace(/\{[^}]+\}/g, '{externalJobId}')
}

function pathTokens(path: string) {
  return path
    .toLowerCase()
    .replace(/\{[^}]+\}/g, '')
    .split('/')
    .filter(Boolean)
    .flatMap(segment => segment.split(/[^a-z0-9]+/))
    .filter(Boolean)
}

function similarName(left: string, right: string) {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/id$/, '')

  const normalizedLeft = normalize(left)
  const normalizedRight = normalize(right)

  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  )
}

function joinUrl(baseUrl: string, path: string) {
  if (!baseUrl) {
    return path
  }

  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

function titleize(path: string) {
  return path
    .replace(/[{}]/g, '')
    .split('/')
    .filter(Boolean)
    .map(segment => segment.replace(/-/g, ' '))
    .join(' ')
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'api-product'
  )
}
