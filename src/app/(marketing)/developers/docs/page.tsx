import Link from 'next/link'

import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { x402Network } from '@/lib/config/chains'

type DocsSection = {
  id: string
  title: string
  group: string
  body: string
}

const providerDocsSections: DocsSection[] = [
  {
    id: 'overview',
    group: 'Start here',
    title: 'How How the gateway sells your API',
    body: `
The gateway lets a provider list an existing HTTPS API as a paid marketplace product. Buyers, applications, CLIs, and autonomous agents call the hosted gateway endpoint. the gateway handles the x402 payment requirement, PYUSD settlement on Kite, provider request forwarding, receipts, and proof metadata.

You do **not** need to clone the app or rebuild your API around blockchain code. Your API only needs normal HTTP endpoints that the gateway can call after payment is settled or reserved.

| Role | What it does |
| --- | --- |
| Provider API | Owns the real product logic, authentication, quotes, jobs, and results. |
| gateway | Prices the request, collects x402 payment, calls the provider, stores receipts, and exposes buyer-facing status. |
| Buyer or agent | Calls the gateway, pays through x402 or managed credits, then receives the provider result or a pollable job. |
`
  },
  {
    id: 'publishing-flow',
    group: 'Start here',
    title: 'Recommended publishing flow',
    body: `
1. Open **Provider -> Products -> New**.
2. Import an OpenAPI file or paste each field manually.
3. Choose **fixed** pricing for predictable per-call work, or **credit_metered** pricing for variable-cost work.
4. Add provider authentication so the gateway can call your upstream API server-side.
5. If your API is long-running, map the job ID and status endpoint.
6. Add request/response schemas and a reference payload.
7. Save as **draft** first, test it, then publish it when the marketplace listing is accurate.

Use **draft** until the endpoint, auth, pricing, and schemas are real. Published listings can appear in marketplace pages and agent tool selection.
`
  },
  {
    id: 'agent-brain',
    group: 'Start here',
    title: 'Autonomous agent brain',
    body: `
Agent runs use OpenAI as the planning and synthesis brain when \`AGENT_LLM_API_KEY\` is configured. The model reads the user objective, source context, budget, max paid actions, and allowed marketplace tools, then returns structured JSON with selected tools, skipped tools, request payloads, budget strategy, and synthesis instructions.

The paid execution still belongs to the gateway:

1. OpenAI chooses the tools and payloads.
2. the gateway quotes every selected product.
3. the gateway skips tools that would exceed the run budget.
4. the gateway pays x402/PYUSD with the configured agent signer in production mode.
5. the gateway stores receipts, response hashes, and final deliverables.
6. the gateway writes the Kite proof when the run is attested.

If \`AGENT_LLM_API_KEY\` is missing, the run is labeled as deterministic fallback. Configure \`AGENT_LLM_API_KEY\` for model-planned runs and either leave \`AGENT_LLM_MODEL\` empty for the default \`gpt-5.2\` or set a lower-cost model for development.
`
  },
  {
    id: 'section-openapi-import',
    group: 'OpenAPI import',
    title: 'Import OpenAPI',
    body: `
OpenAPI import is the fastest way to add many provider endpoints. the gateway reads the spec, detects operations, infers auth, builds schemas, picks reference payloads, and suggests async status mappings.

**What your API should expose**

| Item | Why it helps |
| --- | --- |
| OpenAPI JSON or YAML URL | Lets the gateway import operations without manual copy/paste. |
| Security schemes | Lets the gateway mark auth fields as required. |
| Request bodies | Lets the gateway build buyer-facing request examples. |
| Response schemas | Lets the gateway explain what buyers receive. |
| 202 Accepted or job response schemas | Lets the gateway detect async job creation endpoints. |
| Status endpoints with path parameters | Lets the gateway link a job-creation endpoint to a polling endpoint. |

**Good OpenAPI URL:** \`https://provider.example/api/openapi.json\`  
**Avoid:** private localhost URLs, docs pages that return HTML, or OpenAPI specs that omit request and response schemas.
`
  },
  {
    id: 'field-openApiUrlPreview',
    group: 'OpenAPI import',
    title: 'OpenAPI URL',
    body: `
Paste a public URL that returns raw OpenAPI JSON or YAML.

| Input | Use it? | Why |
| --- | --- | --- |
| \`https://provider.example/api/openapi.json\` | Yes | Direct machine-readable spec. |
| \`https://provider.example/developers/openapi\` | Maybe | Only if it returns JSON/YAML, not an HTML page. |
| \`http://localhost:3000/openapi.json\` | No for production | the gateway cannot fetch your local machine after deployment. |

Validation: must be a valid URL when provided.
`
  },
  {
    id: 'field-openApiBaseUrlPreview',
    group: 'OpenAPI import',
    title: 'Override server URL',
    body: `
Use this when the imported OpenAPI spec has a relative, staging, or incorrect \`servers\` value.

**Input this:** \`https://api.provider.example/v1\`  
**Do not input this:** a product docs URL, marketplace URL, or endpoint path for one operation.

Leave it blank when the OpenAPI spec already has the correct production server URL.
`
  },
  {
    id: 'field-openApiFile',
    group: 'OpenAPI import',
    title: 'Upload OpenAPI file',
    body: `
Upload a local \`.json\`, \`.yaml\`, or \`.yml\` OpenAPI file when the provider spec is not hosted yet.

Use this for private APIs or local specs. Hosted spec URLs are easier to re-import when the provider API changes.
`
  },
  {
    id: 'field-openApiOperationPreview',
    group: 'OpenAPI import',
    title: 'Imported operation',
    body: `
Choose which imported operation becomes the paid marketplace product.

Pick one buyer-facing action per listing. For example, create one listing for **Create job** and another listing for **Summarize document**. Do not publish one listing that hides many unrelated actions behind a single vague endpoint.
`
  },
  {
    id: 'field-openApiPollingPreview',
    group: 'OpenAPI import',
    title: 'Job status endpoint',
    body: `
For async APIs, choose the imported endpoint the gateway should poll with the job ID returned by the paid call.

Good status endpoints usually look like:

\`\`\`http
GET /jobs/{jobId}
GET /renders/{renderId}
GET /exports/{exportId}/status
\`\`\`

The status endpoint should be cheap to call. Buyers should not pay again just to poll a job they already started.
`
  },
  {
    id: 'section-product-details',
    group: 'Product details',
    title: 'Product details',
    body: `
Product details control how the listing appears in the marketplace and which upstream API the gateway calls after payment. These fields should describe the exact API operation buyers will run.

The listing owner, payout wallet, and provider identity come from the connected profile. Complete your profile before publishing products so marketplace, receipt, and provider pages can show the correct creator identity.
`
  },
  {
    id: 'field-name',
    group: 'Product details',
    title: 'Product name',
    body: `
The buyer-facing name shown in marketplace cards, order pages, receipts, and agent tool lists.

**Write:** \`Market Snapshot API\`, \`Video Render Job API\`, \`Document Summary API\`  
**Avoid:** \`Test API\`, \`My endpoint\`, \`Untitled\`

Validation: 3 to 90 characters.
`
  },
  {
    id: 'field-slug',
    group: 'Product details',
    title: 'Slug',
    body: `
The stable URL identifier for the hosted gateway endpoint.

\`\`\`txt
https://yourdomain.com/api/x402/products/{slug}/call
\`\`\`

**Write:** \`market-snapshot-api\`  
**Avoid:** spaces, uppercase letters, underscores, random IDs, or changing it after users integrate.

Validation: 3 to 90 characters, lowercase letters, numbers, and hyphens only.
`
  },
  {
    id: 'field-category',
    group: 'Product details',
    title: 'Category',
    body: `
The marketplace grouping used for discovery and filtering.

| Category | Use for |
| --- | --- |
| \`ai\` | AI generation, classification, extraction, and reasoning. |
| \`data\` | Enrichment, search, analytics, scraping, and market data. |
| \`media\` | Images, video, audio, rendering, and captions. |
| \`agent\` | Tools designed mainly for autonomous workflows. |
| \`commerce\` | Checkout, billing, invoices, customer operations. |
| \`developer\` | CI, code, monitoring, docs, testing, infrastructure. |
`
  },
  {
    id: 'field-endpointUrl',
    group: 'Product details',
    title: 'Provider endpoint URL',
    body: `
The real upstream URL the gateway calls after payment is settled or reserved.

**Input:** the provider API endpoint, not the gateway endpoint.  
**Good:** \`https://api.provider.example/v1/jobs\`  
**Bad:** \`/api/jobs\`, \`localhost\`, or a browser docs page.

Validation: required valid URL.
`
  },
  {
    id: 'field-method',
    group: 'Product details',
    title: 'HTTP method',
    body: `
Choose the upstream method the gateway should use.

Use \`POST\` for actions that create work, transform input, or start jobs. Use \`GET\` for read-only lookups where request values can safely be sent as query parameters.
`
  },
  {
    id: 'field-status',
    group: 'Product details',
    title: 'Visibility',
    body: `
Visibility controls who can discover and run the listing.

| Value | Meaning |
| --- | --- |
| \`draft\` | Save privately while you test fields and credentials. |
| \`published\` | Show in marketplace and allow buyers or agents to use it. |
| \`paused\` | Keep the listing but stop new buyer traffic. |

Publish only after endpoint, auth, pricing, schemas, and polling are real.
`
  },
  {
    id: 'field-description',
    group: 'Product details',
    title: 'Description',
    body: `
Explain what the buyer gets and when they should use it.

**Good:** "Returns a structured market snapshot with competitors, pricing notes, and launch risks for a product category."  
**Bad:** "This is an API."

Validation: 20 to 800 characters.
`
  },
  {
    id: 'section-pricing',
    group: 'Pricing',
    title: 'Fixed or credit-metered pricing',
    body: `
Pricing decides how the gateway calculates the x402 payment requirement.

| Model | Best for | Payment timing |
| --- | --- | --- |
| \`fixed\` | Predictable per-call work | One exact price per call. |
| \`credit_metered\` | Variable work based on duration, tokens, output size, or provider credits | Quote first, pay before expensive work, compare final usage later. |

Credit-metered products should expose a cheap quote endpoint or a deterministic request field. the gateway converts that number into PYUSD with your configured rate and multiplier.
`
  },
  {
    id: 'field-pricingModel',
    group: 'Pricing',
    title: 'Pricing model',
    body: `
Choose \`fixed\` when every successful call costs the same. Choose \`credit_metered\` when price depends on usage.

**Use fixed for:** text cleanup, metadata lookup, basic summary, simple validation.  
**Use credit-metered for:** long-running generation, render duration, token-counted analysis, large exports, usage-based provider plans.
`
  },
  {
    id: 'field-priceUsd',
    group: 'Pricing',
    title: 'Price in PYUSD or fallback price',
    body: `
For fixed pricing, this is the exact PYUSD price per paid call. For credit-metered pricing, this is the fallback price if quote calculation is unavailable.

**Input:** numeric PYUSD amount such as \`0.08\`, \`1\`, or \`25\`.  
**Avoid:** currency symbols, text, negative numbers, or zero.

Validation: positive number up to 100000.
`
  },
  {
    id: 'field-pricingQuoteEndpointUrl',
    group: 'Pricing',
    title: 'Quote endpoint URL',
    body: `
Optional endpoint the gateway calls before payment to calculate a usage-based price.

The quote endpoint must be cheap and side-effect free. It should not start the job, call expensive models, render media, deduct credits, or mutate provider state.

Example response:

\`\`\`json
{
  "estimatedCredits": 180,
  "billing": { "unit": "credit", "estimatedCredits": 180 }
}
\`\`\`

Validation: valid URL when provided.
`
  },
  {
    id: 'field-pricingQuoteMethod',
    group: 'Pricing',
    title: 'Quote method',
    body: `
The HTTP method used for the quote endpoint.

Use \`POST\` when the quote needs the same JSON payload as the paid request. Use \`GET\` only for simple query-based quote APIs.
`
  },
  {
    id: 'field-pricingCreditUnitPath',
    group: 'Pricing',
    title: 'Credit value path',
    body: `
Dot-path to the numeric usage estimate in the quote response, provider response, or request payload.

Examples:

\`\`\`txt
estimatedCredits
billing.estimatedCredits
usage.estimatedCredits
quote.units
\`\`\`

If your quote response is \`{ "billing": { "estimatedCredits": 180 } }\`, enter \`billing.estimatedCredits\`.

Required when pricing model is \`credit_metered\`.
`
  },
  {
    id: 'field-pricingUsageCreditPath',
    group: 'Pricing',
    title: 'Actual usage path',
    body: `
Optional dot-path to final usage in the provider job result or status response.

Use this when final cost can be lower or higher than the quote.

Example:

\`\`\`json
{
  "chargedCredits": 160,
  "refundedCredits": 20,
  "billingStatus": "partially_refunded"
}
\`\`\`

If actual usage is higher than the prepaid quote, the gateway can lock the final result until the buyer pays the delta.
`
  },
  {
    id: 'field-pricingCreditToUsdtRate',
    group: 'Pricing',
    title: 'PYUSD per credit',
    body: `
Conversion rate from provider usage units to PYUSD.

Example: if 100 credits should cost 1 PYUSD, enter \`0.01\`.

\`\`\`txt
credits * PYUSD per credit * multiplier = quoted PYUSD
180 * 0.01 * 1.2 = 2.16 PYUSD
\`\`\`

Required for credit-metered pricing.
`
  },
  {
    id: 'field-pricingMultiplier',
    group: 'Pricing',
    title: 'Pricing multiplier',
    body: `
Optional markup or discount applied after the credit-to-PYUSD conversion.

| Value | Meaning |
| --- | --- |
| \`1\` | No markup or discount. |
| \`1.2\` | Adds 20%. |
| \`0.9\` | Applies a 10% discount. |

Validation: positive number.
`
  },
  {
    id: 'field-pricingMinimumChargeUsd',
    group: 'Pricing',
    title: 'Minimum charge PYUSD',
    body: `
Optional floor so very small jobs still cover provider and gateway overhead.

Use \`0\` when you do not need a minimum. Use values like \`0.05\` or \`1\` when every call has fixed infrastructure cost.
`
  },
  {
    id: 'field-pricingMaximumChargeUsd',
    group: 'Pricing',
    title: 'Maximum charge PYUSD',
    body: `
Optional cap for buyer safety.

Leave blank for no cap. Set a cap when the quote formula could produce unexpectedly high values.

Validation: if provided, it must be greater than the minimum charge.
`
  },
  {
    id: 'section-provider-authentication',
    group: 'Authentication',
    title: 'Provider authentication',
    body: `
Provider authentication is how the gateway calls your upstream API. The buyer never sees these credentials. the gateway stores them server-side and applies them only when forwarding a paid or reserved request.

Never put a provider API key in buyer-side JavaScript. Use these fields so the gateway can keep the secret on the server.
`
  },
  {
    id: 'field-authType',
    group: 'Authentication',
    title: 'Auth type',
    body: `
Choose how the gateway authenticates to the provider API.

| Type | Use when |
| --- | --- |
| \`none\` | The provider endpoint is public or protected elsewhere. |
| \`bearer\` | Header looks like \`Authorization: Bearer secret\`. |
| \`api_key_header\` | Header looks like \`x-api-key: secret\`. |
| \`api_key_query\` | URL has \`?api_key=secret\`. |
| \`basic\` | Provider uses username and password. |
`
  },
  {
    id: 'field-authSecret',
    group: 'Authentication',
    title: 'Auth secret or API key',
    body: `
The provider API key or token the gateway uses server-side.

Required for \`bearer\`, \`api_key_header\`, and \`api_key_query\`.

**Input:** the raw secret value.  
**Do not input:** \`Bearer \` prefix unless your provider specifically expects it as part of the secret. the gateway handles auth formatting based on auth type.
`
  },
  {
    id: 'field-authHeaderName',
    group: 'Authentication',
    title: 'Header name',
    body: `
Header used for bearer or header API-key auth.

Common values:

\`\`\`txt
Authorization
x-api-key
X-API-Key
\`\`\`

Required for \`bearer\` and \`api_key_header\`.
`
  },
  {
    id: 'field-authQueryParam',
    group: 'Authentication',
    title: 'Query parameter name',
    body: `
Query parameter used for \`api_key_query\` authentication.

Example: if the upstream URL needs \`?api_key=secret\`, enter \`api_key\`.

Prefer header auth when possible because query strings can appear in logs.
`
  },
  {
    id: 'field-authUsername',
    group: 'Authentication',
    title: 'Basic auth username',
    body: `
Username used only when auth type is \`basic\`.

Required when auth type is \`basic\`.
`
  },
  {
    id: 'field-authPassword',
    group: 'Authentication',
    title: 'Basic auth password',
    body: `
Password used only when auth type is \`basic\`.

Required when auth type is \`basic\`. Use the eye button in the form to verify the value before saving.
`
  },
  {
    id: 'section-runtime-model',
    group: 'Runtime',
    title: 'Runtime model',
    body: `
Runtime fields tell the gateway whether the provider returns a final result immediately or creates a job that needs polling.
`
  },
  {
    id: 'field-executionMode',
    group: 'Runtime',
    title: 'Execution mode',
    body: `
Use \`synchronous\` when the upstream response contains the final result. Use \`asynchronous\` when the upstream response contains a job ID and work continues in the provider system.
`
  },
  {
    id: 'field-settlementModel',
    group: 'Runtime',
    title: 'Settlement model',
    body: `
Choose when the buyer should pay relative to provider work.

| Model | Use when |
| --- | --- |
| \`pay_on_successful_response\` | Fast synchronous APIs with no expensive work before success. |
| \`pay_on_job_acceptance\` | Async or variable-cost jobs where provider cost starts after job acceptance. |
| \`pay_to_claim_result\` | Buyer should pay only before revealing a completed result. |
`
  },
  {
    id: 'field-resultDelivery',
    group: 'Runtime',
    title: 'Result delivery',
    body: `
How buyers retrieve the usable result.

| Value | Meaning |
| --- | --- |
| \`direct_response\` | Provider returns the final result in the paid response. |
| \`poll_or_webhook\` | Provider returns a job ID; the gateway polls or receives updates. |
| \`claim_after_completion\` | Final payload can stay locked until a claim payment is complete. |
`
  },
  {
    id: 'field-estimatedLatency',
    group: 'Runtime',
    title: 'Estimated latency',
    body: `
Human-readable timing shown to buyers.

Good examples: \`2 seconds\`, \`1-3 minutes\`, \`Depends on file size\`.  
Avoid fake precision such as \`0.0001 seconds\` for long-running APIs.
`
  },
  {
    id: 'field-timeoutSeconds',
    group: 'Runtime',
    title: 'Timeout seconds',
    body: `
Maximum time the gateway waits for the upstream provider response.

Use short values for synchronous APIs. Use longer values for job creation endpoints only if the provider can take time to accept the job.

Validation: integer from 1 to 900.
`
  },
  {
    id: 'section-async-polling',
    group: 'Async polling',
    title: 'Async polling',
    body: `
Async polling is required when the paid call creates a provider job instead of returning the final result.

The paid call starts the job. Polling should be free because it only reads the status of work already paid for or reserved.
`
  },
  {
    id: 'field-statusEndpointUrl',
    group: 'Async polling',
    title: 'Status endpoint URL',
    body: `
Polling URL for async jobs. Use \`{externalJobId}\` where the provider job ID belongs.

Example:

\`\`\`txt
https://api.provider.example/v1/jobs/{externalJobId}
\`\`\`

Required when execution mode is \`asynchronous\`.
`
  },
  {
    id: 'field-statusMethod',
    group: 'Async polling',
    title: 'Status method',
    body: `
HTTP method the gateway uses to poll status.

Most providers should use \`GET\`. Use \`POST\` only when the provider status API requires a JSON body.
`
  },
  {
    id: 'field-externalJobIdPath',
    group: 'Async polling',
    title: 'External job ID path',
    body: `
Dot-path where the gateway finds the provider job ID in the job creation response.

Examples:

\`\`\`txt
jobId
data.id
result.job.id
videoJobId
\`\`\`

Required for async APIs.
`
  },
  {
    id: 'field-statusPath',
    group: 'Async polling',
    title: 'Status path',
    body: `
Dot-path where the gateway reads the provider job status in polling responses.

Examples:

\`\`\`txt
status
data.status
job.state
\`\`\`

the gateway expects values that can be mapped to processing, ready, completed, failed, or cancelled behavior.
`
  },
  {
    id: 'field-resultUrlPath',
    group: 'Async polling',
    title: 'Result URL path',
    body: `
Optional dot-path where the gateway reads the final output URL.

Examples: \`resultUrl\`, \`output.url\`, \`data.assets.videoUrl\`, \`result.publicProjectUrl\`, or \`result.cloneUrl\`.

For provider APIs that create editable projects instead of a finished file, return a public handoff or clone URL. the gateway treats that URL as the paid result and can complete the order when the provider status is completed or handoff-ready.
`
  },
  {
    id: 'field-errorMessagePath',
    group: 'Async polling',
    title: 'Error message path',
    body: `
Optional dot-path where the gateway reads provider error details.

Use this so buyers see a useful failure reason instead of a generic failed status.
`
  },
  {
    id: 'section-schemas',
    group: 'Schemas',
    title: 'Schemas and examples',
    body: `
Schemas make the marketplace understandable. They also help agents decide which tools fit a task.

Use simple JSON objects that describe field names and expected values. You do not need a perfect formal JSON Schema for the first listing, but the examples should match the real API.
`
  },
  {
    id: 'field-requestSchemaJson',
    group: 'Schemas',
    title: 'Request schema',
    body: `
JSON object describing what buyers should send.

Good example:

\`\`\`json
{
  "prompt": "string",
  "durationSeconds": "number",
  "quality": "720p | 1080p | 4k"
}
\`\`\`

Avoid empty objects for published listings.
`
  },
  {
    id: 'field-responseSchemaJson',
    group: 'Schemas',
    title: 'Response schema',
    body: `
JSON object describing what buyers receive.

For async products, include job and status fields. For credit-metered products, include final usage fields when available.

\`\`\`json
{
  "jobId": "string",
  "status": "queued | processing | review_required | completed | failed",
  "resultUrl": "string | undefined",
  "result": {
    "publicProjectUrl": "string | undefined",
    "cloneUrl": "string | undefined"
  },
  "chargedCredits": "number | undefined"
}
\`\`\`
`
  },
  {
    id: 'field-referencePayloadJson',
    group: 'Schemas',
    title: 'Reference payload',
    body: `
Example request shown to buyers and used by agent runs as a starting payload.

Use realistic values that can succeed for this operation. Do not include private provider API keys here.

\`\`\`json
{
  "prompt": "Create a product launch asset.",
  "durationSeconds": 30,
  "quality": "1080p"
}
\`\`\`
`
  },
  {
    id: 'section-automation',
    group: 'Automation',
    title: 'Webhooks and agent availability',
    body: `
Automation fields help the gateway keep long-running work updated and make products available to autonomous agents.
`
  },
  {
    id: 'field-webhookUrl',
    group: 'Automation',
    title: 'Webhook URL',
    body: `
Optional provider callback URL for future webhook coordination.

Use a URL your provider controls. Leave blank when polling is enough.

Validation: valid URL when provided.
`
  },
  {
    id: 'field-isAgentReady',
    group: 'Automation',
    title: 'Agent-ready listing',
    body: `
When enabled, the product can appear as a selectable tool in autonomous agent runs.

Only enable this when:

- The request schema is clear.
- The reference payload is safe.
- Pricing is predictable or quote-first.
- The provider endpoint can handle autonomous calls without manual approval.
`
  },
  {
    id: 'provider-code-changes',
    group: 'Provider code',
    title: 'What to add to your own API codebase',
    body: `
You can integrate a provider API with the gateway using normal HTTP patterns.

## Fixed-price API

Fixed-price APIs only need the real paid endpoint:

\`\`\`ts
app.post("/api/summarize", async (req, res) => {
  const result = await summarize(req.body.text)
  res.json({
    summary: result.summary,
    requestId: result.requestId
  })
})
\`\`\`

List this as \`pricingModel: "fixed"\`. the gateway charges the configured PYUSD amount when the paid request succeeds.

## Credit-metered async API

Variable-cost APIs should expose a quote endpoint and a job endpoint:

\`\`\`ts
app.post("/api/quote", async (req, res) => {
  const estimatedCredits = estimateCredits(req.body)
  res.json({
    estimatedCredits,
    billing: {
      unit: "credit",
      estimatedCredits
    }
  })
})

app.post("/api/jobs", async (req, res) => {
  const job = await createJob({
    input: req.body,
    billingMode: req.body.billingMode,
    externalReference: req.body.externalReference
  })

  res.status(202).json({
    jobId: job.id,
    status: "queued",
    estimatedCredits: job.estimatedCredits
  })
})

app.get("/api/jobs/:jobId", async (req, res) => {
  const job = await getJob(req.params.jobId)
  res.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    resultUrl: job.resultUrl,
    result: {
      publicProjectUrl: job.publicProjectUrl,
      cloneUrl: job.cloneUrl
    },
    estimatedCredits: job.estimatedCredits,
    chargedCredits: job.chargedCredits,
    refundedCredits: job.refundedCredits,
    billingStatus: job.billingStatus,
    refundReason: job.refundReason
  })
})
\`\`\`

The provider API should stay generic. It reports credits, job state, and handoff/result URLs. the gateway maps those credits to x402 payments, receipts, refunds, deltas, and proofs. If a provider returns \`review_required\` without a result URL, the gateway keeps the order processing instead of releasing funds. If the provider returns a cloneable handoff URL, the gateway can complete the order and release escrow even when the final render is handled separately.

For temporary provider outages, return a normal error payload with \`retryable: true\`, an HTTP 408/429/5xx status, or a \`retry_after\` value. the gateway keeps escrow reserved, retries the provider call or status check, and refunds only when the 24-hour retry window expires without a valid provider result.
`
  }
]

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className='text-foreground/75 my-3 text-sm leading-7'>{children}</p>
  ),
  h2: ({ children }) => (
    <h3 className='font-display text-foreground mt-7 text-2xl'>{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className='text-foreground mt-6 text-lg font-semibold'>{children}</h4>
  ),
  ul: ({ children }) => (
    <ul className='text-foreground/75 my-3 list-disc space-y-2 pl-5 text-sm leading-7'>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className='text-foreground/75 my-3 list-decimal space-y-2 pl-5 text-sm leading-7'>
      {children}
    </ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-')

    if (isBlock) {
      return <code className={className}>{children}</code>
    }

    return (
      <code className='bg-muted text-foreground rounded px-1.5 py-0.5 text-[0.85em]'>
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className='bg-muted text-foreground my-4 overflow-auto rounded-lg p-4 text-xs leading-6'>
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className='my-4 overflow-x-auto'>
      <table className='border-border w-full min-w-[520px] border-collapse text-sm'>
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className='border-border bg-muted text-foreground border px-3 py-2 text-left font-semibold'>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className='border-border text-foreground/75 border px-3 py-2 align-top'>
      {children}
    </td>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      className='text-primary font-semibold underline-offset-4 hover:underline'
    >
      {children}
    </a>
  )
}

export default function DeveloperDocsPage() {
  const groupedSections = providerDocsSections.reduce<
    Record<string, DocsSection[]>
  >((groups, section) => {
    groups[section.group] = groups[section.group] ?? []
    groups[section.group].push(section)
    return groups
  }, {})

  return (
    <div className='mx-auto w-full max-w-7xl px-6 py-14'>
      <section className='space-y-4'>
        <Badge>GitHub-flavored docs</Badge>
        <h1 className='font-display max-w-3xl text-4xl leading-tight'>
          Provider integration guide
        </h1>
        <p className='text-foreground/70 max-w-3xl text-sm leading-6'>
          A field-by-field guide for listing paid APIs, importing OpenAPI specs,
          supporting fixed and usage-metered pricing, and preparing provider
          endpoints for x402-paid calls on {x402Network}.
        </p>
        <div className='flex flex-col gap-3 sm:flex-row'>
          <Link
            href='/provider/products/new'
            className={buttonClasses({ size: 'sm' })}
          >
            List a paid API
          </Link>
          <Link
            href='/api/reference'
            className={buttonClasses({ variant: 'outline', size: 'sm' })}
          >
            Open API reference
          </Link>
          <Link
            href='/api/openapi.json'
            className={buttonClasses({ variant: 'outline', size: 'sm' })}
          >
            Open OpenAPI JSON
          </Link>
        </div>
      </section>

      <div className='mt-10 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]'>
        <aside className='lg:sticky lg:top-28 lg:self-start'>
          <nav className='border-border bg-card/70 max-h-[calc(100vh-8rem)] overflow-auto rounded-lg border p-4'>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              On this page
            </p>
            <div className='mt-4 space-y-5'>
              {Object.entries(groupedSections).map(([group, sections]) => (
                <div key={group}>
                  <p className='text-foreground text-sm font-semibold'>
                    {group}
                  </p>
                  <ul className='mt-2 space-y-1'>
                    {sections.map(section => (
                      <li key={section.id}>
                        <a
                          href={`#${section.id}`}
                          className='text-foreground/65 hover:text-primary block rounded-md px-2 py-1 text-sm transition'
                        >
                          {section.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </nav>
        </aside>

        <main className='space-y-5'>
          {providerDocsSections.map(section => (
            <section
              key={section.id}
              id={section.id}
              className='border-border bg-card scroll-mt-28 rounded-lg border p-6 shadow-sm'
            >
              <p className='text-foreground/50 text-xs tracking-[0.16em] uppercase'>
                {section.group}
              </p>
              <h2 className='font-display mt-2 text-3xl'>{section.title}</h2>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {section.body}
              </ReactMarkdown>
            </section>
          ))}
        </main>
      </div>
    </div>
  )
}
