import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
    createdAt: v.number()
  }).index('by_name', ['name']),
  users: defineTable({
    walletAddress: v.string(),
    fullName: v.string(),
    username: v.string(),
    normalizedUsername: v.string(),
    email: v.string(),
    plan: v.union(v.literal('free'), v.literal('base'), v.literal('plus')),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_wallet_address', ['walletAddress'])
    .index('by_normalized_username', ['normalizedUsername']),
  webhookEvents: defineTable({
    source: v.string(),
    eventType: v.string(),
    payloadText: v.string(),
    payloadJson: v.optional(v.any()),
    headers: v.array(
      v.object({
        name: v.string(),
        value: v.string()
      })
    ),
    status: v.union(v.literal('received'), v.literal('processed')),
    receivedAt: v.number(),
    processedAt: v.optional(v.number())
  })
    .index('by_source', ['source'])
    .index('by_event_type', ['eventType'])
    .index('by_received_at', ['receivedAt']),
  providers: defineTable({
    userId: v.id('users'),
    slug: v.string(),
    description: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    status: v.union(
      v.literal('active'),
      v.literal('pending'),
      v.literal('suspended')
    ),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_user_id', ['userId'])
    .index('by_slug', ['slug'])
    .index('by_status', ['status']),
  apiProducts: defineTable({
    providerId: v.id('providers'),
    slug: v.string(),
    name: v.string(),
    description: v.string(),
    category: v.union(
      v.literal('ai'),
      v.literal('data'),
      v.literal('media'),
      v.literal('agent'),
      v.literal('commerce'),
      v.literal('developer')
    ),
    priceUsd: v.number(),
    priceLabel: v.string(),
    endpointUrl: v.string(),
    method: v.union(v.literal('GET'), v.literal('POST')),
    estimatedLatency: v.optional(v.string()),
    executionMode: v.optional(
      v.union(v.literal('synchronous'), v.literal('asynchronous'))
    ),
    settlementModel: v.optional(
      v.union(
        v.literal('pay_on_successful_response'),
        v.literal('pay_on_job_acceptance'),
        v.literal('pay_to_claim_result')
      )
    ),
    resultDelivery: v.optional(
      v.union(
        v.literal('direct_response'),
        v.literal('poll_or_webhook'),
        v.literal('claim_after_completion')
      )
    ),
    authType: v.optional(
      v.union(
        v.literal('none'),
        v.literal('bearer'),
        v.literal('api_key_header'),
        v.literal('api_key_query'),
        v.literal('basic')
      )
    ),
    authHeaderName: v.optional(v.string()),
    authQueryParam: v.optional(v.string()),
    authSecretName: v.optional(v.string()),
    statusEndpointUrl: v.optional(v.string()),
    statusMethod: v.optional(v.union(v.literal('GET'), v.literal('POST'))),
    externalJobIdPath: v.optional(v.string()),
    statusPath: v.optional(v.string()),
    resultUrlPath: v.optional(v.string()),
    errorMessagePath: v.optional(v.string()),
    timeoutSeconds: v.optional(v.number()),
    requestSchemaJson: v.string(),
    responseSchemaJson: v.string(),
    demoPayloadJson: v.optional(v.string()),
    productJson: v.optional(v.string()),
    isX402Protected: v.boolean(),
    isAgentReady: v.boolean(),
    status: v.union(
      v.literal('draft'),
      v.literal('published'),
      v.literal('paused')
    ),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_provider', ['providerId'])
    .index('by_slug', ['slug'])
    .index('by_status', ['status'])
    .index('by_category', ['category']),
  apiProductVersions: defineTable({
    productId: v.id('apiProducts'),
    version: v.number(),
    requestSchemaJson: v.string(),
    responseSchemaJson: v.string(),
    endpointUrl: v.string(),
    createdAt: v.number()
  })
    .index('by_product', ['productId'])
    .index('by_product_version', ['productId', 'version']),
  orders: defineTable({
    orderKey: v.optional(v.string()),
    orderJson: v.optional(v.string()),
    buyerWallet: v.string(),
    providerId: v.optional(v.id('providers')),
    productId: v.optional(v.id('apiProducts')),
    status: v.union(
      v.literal('created'),
      v.literal('payment_required'),
      v.literal('paid'),
      v.literal('forwarding'),
      v.literal('processing'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('expired')
    ),
    amountUsd: v.number(),
    amountUsdt: v.optional(v.string()),
    providerIdempotencyKey: v.optional(v.string()),
    requestPayloadJson: v.string(),
    responsePayloadJson: v.optional(v.string()),
    externalJobId: v.optional(v.string()),
    resultUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_order_key', ['orderKey'])
    .index('by_buyer_wallet', ['buyerWallet'])
    .index('by_provider', ['providerId'])
    .index('by_product', ['productId'])
    .index('by_status', ['status']),
  receipts: defineTable({
    receiptKey: v.optional(v.string()),
    receiptJson: v.optional(v.string()),
    orderId: v.optional(v.id('orders')),
    buyerWallet: v.string(),
    providerWallet: v.string(),
    amountUsdt: v.string(),
    network: v.literal('eip155:2368'),
    txHash: v.optional(v.string()),
    settlementPayloadJson: v.optional(v.string()),
    explorerUrl: v.optional(v.string()),
    createdAt: v.number()
  })
    .index('by_receipt_key', ['receiptKey'])
    .index('by_order', ['orderId'])
    .index('by_buyer_wallet', ['buyerWallet']),
  managedCreditAccounts: defineTable({
    wallet: v.string(),
    apiKey: v.string(),
    accountJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_wallet', ['wallet'])
    .index('by_api_key', ['apiKey']),
  apiRequests: defineTable({
    orderId: v.id('orders'),
    productId: v.id('apiProducts'),
    providerId: v.id('providers'),
    requestId: v.string(),
    status: v.union(
      v.literal('started'),
      v.literal('forwarded'),
      v.literal('completed'),
      v.literal('failed')
    ),
    latencyMs: v.optional(v.number()),
    upstreamStatusCode: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    createdAt: v.number()
  })
    .index('by_order', ['orderId'])
    .index('by_product', ['productId'])
    .index('by_request_id', ['requestId']),
  webhookEndpoints: defineTable({
    providerId: v.id('providers'),
    url: v.string(),
    secretName: v.optional(v.string()),
    status: v.union(v.literal('active'), v.literal('paused')),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index('by_provider', ['providerId']),
  webhookDeliveries: defineTable({
    endpointId: v.id('webhookEndpoints'),
    orderId: v.optional(v.id('orders')),
    eventType: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('delivered'),
      v.literal('failed')
    ),
    responseStatusCode: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index('by_endpoint', ['endpointId']),
  apiUsageEvents: defineTable({
    providerId: v.id('providers'),
    productId: v.id('apiProducts'),
    orderId: v.optional(v.id('orders')),
    requestId: v.string(),
    eventType: v.string(),
    amountUsdt: v.optional(v.string()),
    platformFeeUsdt: v.optional(v.string()),
    providerAmountUsdt: v.optional(v.string()),
    createdAt: v.number()
  })
    .index('by_provider', ['providerId'])
    .index('by_product', ['productId'])
    .index('by_request_id', ['requestId']),
  providerPayouts: defineTable({
    providerId: v.id('providers'),
    amountUsdt: v.string(),
    status: v.union(
      v.literal('queued'),
      v.literal('processing'),
      v.literal('paid'),
      v.literal('failed')
    ),
    txHash: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index('by_provider', ['providerId']),
  agentRuns: defineTable({
    runKey: v.optional(v.string()),
    runJson: v.optional(v.string()),
    ownerWallet: v.string(),
    template: v.string(),
    objective: v.string(),
    sourceText: v.optional(v.string()),
    budgetCapUsdt: v.number(),
    maxPaidActions: v.number(),
    allowedToolsJson: v.string(),
    mode: v.union(v.literal('demo'), v.literal('production')),
    status: v.union(
      v.literal('planned'),
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('attesting'),
      v.literal('attested')
    ),
    summary: v.string(),
    deliverablesJson: v.optional(v.string()),
    proofId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_run_key', ['runKey'])
    .index('by_owner_wallet', ['ownerWallet'])
    .index('by_status', ['status']),
  agentActions: defineTable({
    runId: v.id('agentRuns'),
    productSlug: v.string(),
    productName: v.string(),
    providerName: v.string(),
    status: v.union(
      v.literal('planned'),
      v.literal('quoted'),
      v.literal('paid'),
      v.literal('completed'),
      v.literal('skipped'),
      v.literal('failed')
    ),
    amountUsdt: v.string(),
    requestPayloadJson: v.string(),
    responsePayloadJson: v.optional(v.string()),
    receiptId: v.optional(v.string()),
    orderId: v.optional(v.string()),
    requestId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_run', ['runId'])
    .index('by_status', ['status']),
  agentProofs: defineTable({
    proofKey: v.optional(v.string()),
    proofJson: v.optional(v.string()),
    runId: v.optional(v.id('agentRuns')),
    runKey: v.optional(v.string()),
    ownerWallet: v.string(),
    proofHash: v.string(),
    proofUri: v.string(),
    network: v.literal('eip155:2368'),
    txHash: v.string(),
    explorerUrl: v.optional(v.string()),
    receiptIdsJson: v.string(),
    totalSpendUsdt: v.string(),
    createdAt: v.number()
  })
    .index('by_proof_key', ['proofKey'])
    .index('by_run', ['runId'])
    .index('by_run_key', ['runKey'])
    .index('by_owner_wallet', ['ownerWallet'])
    .index('by_proof_hash', ['proofHash']),
  savedExamples: defineTable({
    productId: v.id('apiProducts'),
    title: v.string(),
    payloadJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index('by_product', ['productId']),
  reviews: defineTable({
    productId: v.id('apiProducts'),
    buyerWallet: v.string(),
    rating: v.number(),
    body: v.optional(v.string()),
    status: v.union(v.literal('published'), v.literal('hidden')),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_product', ['productId'])
    .index('by_buyer_wallet', ['buyerWallet'])
})
