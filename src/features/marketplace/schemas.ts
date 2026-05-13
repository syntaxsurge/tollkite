import { z } from 'zod'

import { paymentTokenSymbol } from '@/lib/config/chains'

export const apiProductCategories = [
  'ai',
  'data',
  'media',
  'agent',
  'commerce',
  'developer'
] as const

export const apiProductStatuses = ['draft', 'published', 'paused'] as const
export const apiProductExecutionModes = ['synchronous', 'asynchronous'] as const
export const apiProductSettlementModels = [
  'pay_on_successful_response',
  'pay_on_job_acceptance',
  'pay_to_claim_result'
] as const
export const apiProductResultDeliveries = [
  'direct_response',
  'poll_or_webhook',
  'claim_after_completion'
] as const
export const apiProductAuthTypes = [
  'none',
  'bearer',
  'api_key_header',
  'api_key_query',
  'basic'
] as const
export const apiProductPricingModels = ['fixed', 'credit_metered'] as const

export const orderStatuses = [
  'created',
  'payment_required',
  'quoted',
  'paid',
  'forwarding',
  'processing',
  'ready',
  'delta_payment_required',
  'completed',
  'failed',
  'expired'
] as const

export const apiProductBaseSchema = z.object({
  name: z.string().trim().min(3).max(90),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(90)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: z.enum(apiProductCategories),
  description: z.string().trim().min(20).max(800),
  priceUsd: z.coerce.number().positive().max(100000),
  pricingModel: z.enum(apiProductPricingModels).default('fixed'),
  pricingQuoteEndpointUrl: z.string().trim().url().optional().or(z.literal('')),
  pricingQuoteMethod: z.enum(['GET', 'POST']).default('POST'),
  pricingCreditUnitPath: z.string().trim().max(120).optional(),
  pricingUsageCreditPath: z.string().trim().max(120).optional(),
  pricingCreditToUsdtRate: z.coerce.number().positive().max(100000).default(1),
  pricingMultiplier: z.coerce.number().positive().max(100000).default(1),
  pricingMinimumChargeUsd: z.coerce.number().min(0).max(100000).default(0),
  pricingMaximumChargeUsd: z.coerce
    .number()
    .min(0)
    .max(100000)
    .optional()
    .or(z.literal('')),
  endpointUrl: z.string().trim().url(),
  method: z.enum(['GET', 'POST']),
  estimatedLatency: z.string().trim().min(2).max(80).default('Depends on API'),
  executionMode: z.enum(apiProductExecutionModes).default('synchronous'),
  settlementModel: z
    .enum(apiProductSettlementModels)
    .default('pay_on_successful_response'),
  resultDelivery: z.enum(apiProductResultDeliveries).default('direct_response'),
  authType: z.enum(apiProductAuthTypes).default('none'),
  authHeaderName: z.string().trim().max(80).optional(),
  authQueryParam: z.string().trim().max(80).optional(),
  authSecret: z.string().trim().max(2000).optional(),
  authUsername: z.string().trim().max(200).optional(),
  authPassword: z.string().trim().max(2000).optional(),
  timeoutSeconds: z.coerce.number().int().min(1).max(900).default(60),
  statusEndpointUrl: z.string().trim().url().optional().or(z.literal('')),
  statusMethod: z.enum(['GET', 'POST']).default('GET'),
  externalJobIdPath: z.string().trim().max(120).optional(),
  statusPath: z.string().trim().max(120).optional(),
  resultUrlPath: z.string().trim().max(120).optional(),
  errorMessagePath: z.string().trim().max(120).optional(),
  requestSchemaJson: z.string().trim().min(2),
  responseSchemaJson: z.string().trim().min(2),
  referencePayloadJson: z.string().trim().optional(),
  status: z.enum(apiProductStatuses).default('draft'),
  isX402Protected: z.coerce.boolean().default(true),
  isAgentReady: z.coerce.boolean().default(true),
  webhookUrl: z.string().trim().url().optional().or(z.literal(''))
})

export const apiProductSchema =
  apiProductBaseSchema.superRefine(refineApiProduct)

export const providerProductInputSchema =
  apiProductBaseSchema.superRefine(refineApiProduct)

export function refineApiProduct(
  value: z.infer<typeof apiProductBaseSchema>,
  context: z.RefinementCtx
) {
  if (
    ['bearer', 'api_key_header', 'api_key_query'].includes(value.authType) &&
    !value.authSecret
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['authSecret'],
      message: 'Auth secret or API key is required for this auth type.'
    })
  }

  if (
    ['bearer', 'api_key_header'].includes(value.authType) &&
    !value.authHeaderName
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['authHeaderName'],
      message: 'Header name is required for bearer or header API-key auth.'
    })
  }

  if (value.authType === 'api_key_query' && !value.authQueryParam) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['authQueryParam'],
      message: 'Query parameter name is required for query API-key auth.'
    })
  }

  if (value.authType === 'basic') {
    if (!value.authUsername) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['authUsername'],
        message: 'Basic auth username is required.'
      })
    }

    if (!value.authPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['authPassword'],
        message: 'Basic auth password is required.'
      })
    }
  }

  if (value.executionMode === 'asynchronous') {
    if (!value.statusEndpointUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['statusEndpointUrl'],
        message: 'Status endpoint URL is required for async APIs.'
      })
    }

    if (!value.externalJobIdPath) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['externalJobIdPath'],
        message: 'External job ID path is required for async APIs.'
      })
    }

    if (!value.statusPath) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['statusPath'],
        message: 'Status path is required for async APIs.'
      })
    }
  }

  if (value.pricingModel === 'credit_metered') {
    if (!value.pricingCreditUnitPath) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pricingCreditUnitPath'],
        message: 'Credit value path is required for credit-metered pricing.'
      })
    }

    if (
      value.pricingMaximumChargeUsd !== '' &&
      value.pricingMaximumChargeUsd !== undefined &&
      Number(value.pricingMaximumChargeUsd) > 0 &&
      Number(value.pricingMaximumChargeUsd) <
        Number(value.pricingMinimumChargeUsd)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pricingMaximumChargeUsd'],
        message: 'Maximum charge must be greater than the minimum charge.'
      })
    }
  }

  addJsonObjectIssue(
    context,
    value.requestSchemaJson,
    'requestSchemaJson',
    'Request schema must be a valid JSON object.'
  )
  addJsonObjectIssue(
    context,
    value.responseSchemaJson,
    'responseSchemaJson',
    'Response schema must be a valid JSON object.'
  )

  if (value.referencePayloadJson) {
    addJsonObjectIssue(
      context,
      value.referencePayloadJson,
      'referencePayloadJson',
      'Reference payload must be a valid JSON object.'
    )
  }
}

function addJsonObjectIssue(
  context: z.RefinementCtx,
  value: string,
  path: string,
  message: string
) {
  try {
    const parsed = JSON.parse(value) as unknown

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(message)
    }
  } catch {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [path],
      message
    })
  }
}

export const createOrderSchema = z.object({
  productSlug: z.string().trim().min(3),
  buyerWallet: z.string().trim().min(10),
  requestPayloadJson: z.union([
    z.string().trim().min(2),
    z.record(z.unknown())
  ]),
  allowDraftTest: z.coerce.boolean().optional().default(false)
})

export type ApiProductFormValues = z.infer<typeof apiProductSchema>
export type CreateOrderValues = z.infer<typeof createOrderSchema>

export function parseJsonField(value: string, fieldName: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    throw new Error(`${fieldName} must contain valid JSON.`)
  }
}

export function formatUsdtAmount(amount: number) {
  return `${amount.toFixed(2)} ${paymentTokenSymbol}`
}

export function getPlatformFee(amountUsd: number, feeBps = 500) {
  return Number(((amountUsd * feeBps) / 10000).toFixed(2))
}

export function getProviderAmount(amountUsd: number, feeBps = 500) {
  return Number((amountUsd - getPlatformFee(amountUsd, feeBps)).toFixed(2))
}
