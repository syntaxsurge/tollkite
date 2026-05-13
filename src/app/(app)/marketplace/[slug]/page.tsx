import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Bot, Code2, Wallet } from 'lucide-react'

import { JsonViewer } from '@/components/data-display/json-viewer'
import { WalletOwnerCard } from '@/components/data-display/wallet-owner-card'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CopyTextButton } from '@/features/marketplace/copy-endpoint-button'
import { getProductBySlug } from '@/features/marketplace/products'

type ProductPageProps = {
  params: Promise<{
    slug: string
  }>
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  if (!product) {
    notFound()
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const endpointUrl = new URL(product.endpointPath, appUrl).toString()
  const requestPayload = JSON.stringify(product.referencePayload, null, 2)
  const compactPayload = JSON.stringify(product.referencePayload)
  const queryString = new URLSearchParams(
    Object.entries(product.referencePayload).map(([key, value]) => [
      key,
      String(value)
    ])
  ).toString()
  const callUrl =
    product.method === 'GET' && queryString
      ? `${endpointUrl}?${queryString}`
      : endpointUrl
  const curlCommand =
    product.method === 'POST'
      ? `curl -i -X POST ${endpointUrl} \\
  -H "Content-Type: application/json" \\
  -d '${compactPayload}'`
      : `curl -i "${callUrl}"`
  const installCommand = 'npm install @x402/fetch @x402/evm viem'
  const paidRequestOptions =
    product.method === 'POST'
      ? `{
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json"
  },
  body: JSON.stringify(${requestPayload})
}`
      : `{
  method: "GET",
  headers: {
    Accept: "application/json"
  }
}`
  const buyerIntegrationTarget =
    product.method === 'GET'
      ? `\`${endpointUrl}?\${params}\``
      : `"${endpointUrl}"`
  const buyerIntegrationSetup =
    product.method === 'GET'
      ? `const params = new URLSearchParams(${requestPayload});
`
      : ''
  const buyerIntegrationCode = `import { x402Client, x402HTTPClient, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const privateKey = process.env.EVM_PRIVATE_KEY;

if (!privateKey) {
  throw new Error("Set EVM_PRIVATE_KEY to a wallet funded with the configured payment token.");
}

const signer = privateKeyToAccount(privateKey);
const client = new x402Client();

registerExactEvmScheme(client, { signer });

const fetchWithPayment = wrapFetchWithPayment(fetch, client);
${buyerIntegrationSetup}const response = await fetchWithPayment(${buyerIntegrationTarget}, ${paidRequestOptions});

const body = await response.json();
const payment = new x402HTTPClient(client).getPaymentSettleResponse(name =>
  response.headers.get(name)
);

console.log({ body, payment });`
  const settlementLabel = getSettlementLabel(product.settlementModel)
  const resultDeliveryLabel = getResultDeliveryLabel(product.resultDelivery)

  return (
    <div className='space-y-8'>
      <section className='bg-panel-sheen border-foreground/10 rounded-lg border p-6'>
        <div className='grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:items-start'>
          <div className='min-w-0 space-y-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge>{product.category}</Badge>
              <Badge>{product.method}</Badge>
              {product.isX402Protected ? <Badge>x402 protected</Badge> : null}
              {product.isAgentReady ? <Badge>Agent-ready</Badge> : null}
            </div>
            <div>
              <h1 className='font-display mt-2 text-4xl'>{product.name}</h1>
            </div>
            <p className='text-foreground/70 max-w-2xl text-sm leading-6'>
              {product.description}
            </p>
            <WalletOwnerCard
              walletAddress={product.ownerWallet ?? product.providerWallet}
              displayName={product.providerName}
              className='max-w-xl'
            />
            <div className='flex flex-col gap-3 pt-2 sm:flex-row'>
              <Link
                href={`/orders/new?product=${product.slug}`}
                className={buttonClasses({ size: 'sm' })}
              >
                <Wallet className='h-4 w-4' aria-hidden />
                Run
              </Link>
              <a
                href='#use-from-code'
                className={buttonClasses({ variant: 'outline', size: 'sm' })}
              >
                <Code2 className='h-4 w-4' aria-hidden />
                Code
              </a>
              <Link
                href={`/agents/new?tool=${product.slug}`}
                className={buttonClasses({ variant: 'outline', size: 'sm' })}
              >
                <Bot className='h-4 w-4' aria-hidden />
                Agent
              </Link>
            </div>
          </div>
          <Card className='bg-background/85 min-w-0 space-y-4'>
            {[
              ['Price', product.priceLabel],
              ['Settlement', settlementLabel],
              ['Processing', product.estimatedLatency],
              ['Result delivery', resultDeliveryLabel],
              [
                'Provider auth',
                product.providerAuth?.type === 'none'
                  ? 'No upstream credential'
                  : `${product.providerAuth?.type ?? 'none'} configured`
              ],
              ['Endpoint', endpointUrl]
            ].map(([label, value]) => (
              <div key={label}>
                <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
                  {label}
                </p>
                <p className='mt-1 min-w-0 text-sm font-semibold break-all'>
                  {value}
                </p>
              </div>
            ))}
            <CopyTextButton text={endpointUrl} label='Copy endpoint' />
          </Card>
        </div>
      </section>

      <section className='grid min-w-0 gap-5 2xl:grid-cols-2'>
        <SchemaCard title='Request schema' schema={product.requestSchema} />
        <SchemaCard title='Response schema' schema={product.responseSchema} />
      </section>

      <section className='grid min-w-0 gap-5 lg:grid-cols-3'>
        <Card className='min-w-0'>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Execution mode
          </p>
          <h2 className='mt-3 text-xl font-semibold capitalize'>
            {product.executionMode}
          </h2>
          <p className='text-foreground/70 mt-2 text-sm leading-6'>
            {product.executionMode === 'asynchronous'
              ? 'Returns a job first, then final output later.'
              : 'Returns the completed result immediately.'}
          </p>
        </Card>
        <Card className='min-w-0'>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Billing model
          </p>
          <h2 className='mt-3 text-xl font-semibold'>{settlementLabel}</h2>
          <p className='text-foreground/70 mt-2 text-sm leading-6'>
            {getSettlementDescription(product.settlementModel)}
          </p>
        </Card>
        <Card className='min-w-0'>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Result handling
          </p>
          <h2 className='mt-3 text-xl font-semibold'>{resultDeliveryLabel}</h2>
          <p className='text-foreground/70 mt-2 text-sm leading-6'>
            {getResultDeliveryDescription(product.resultDelivery)}
          </p>
        </Card>
      </section>

      <section className='grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]'>
        <Card className='min-w-0'>
          <JsonViewer
            title='Reference request body'
            value={product.referencePayload}
            copyLabel='Copy JSON'
          />
        </Card>
        <Card id='use-from-code' className='min-w-0 scroll-mt-28 space-y-5'>
          <div className='space-y-2'>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              External app integration
            </p>
            <p className='text-foreground/70 text-sm leading-6'>
              Call this hosted endpoint from a backend, CLI, or agent with an
              x402 buyer client. Keep the signer server-side.
            </p>
          </div>

          <CodeBlock
            title='Install in your app'
            code={installCommand}
            copyLabel='Copy install'
          />
          <CodeBlock
            title='Call from your backend or agent'
            code={buyerIntegrationCode}
            copyLabel='Copy integration'
          />
          <CodeBlock
            title='Inspect payment requirement'
            code={curlCommand}
            copyLabel='Copy curl'
          />
        </Card>
      </section>
    </div>
  )
}

function getSettlementLabel(model: string) {
  if (model === 'pay_on_job_acceptance') {
    return 'Pay when job is accepted'
  }

  if (model === 'pay_to_claim_result') {
    return 'Pay to claim completed result'
  }

  return 'Pay after successful response'
}

function getSettlementDescription(model: string) {
  if (model === 'pay_on_job_acceptance') {
    return 'Best for providers that incur cost immediately. the gateway settles once the provider accepts the job, then tracks the final result separately.'
  }

  if (model === 'pay_to_claim_result') {
    return 'Best for long-running APIs when buyers should only pay after successful completion. The result is locked until payment settles.'
  }

  return 'Best for fast APIs. the gateway calls the provider first and settles only when the provider returns a successful response.'
}

function getResultDeliveryLabel(delivery: string) {
  if (delivery === 'poll_or_webhook') {
    return 'Poll or webhook'
  }

  if (delivery === 'claim_after_completion') {
    return 'Claim after completion'
  }

  return 'Direct response'
}

function getResultDeliveryDescription(delivery: string) {
  if (delivery === 'poll_or_webhook') {
    return 'The first response includes a job id. Buyers can poll the gateway, and providers can update status through a webhook.'
  }

  if (delivery === 'claim_after_completion') {
    return 'The provider completes work first, then the gateway charges the buyer before revealing the final output.'
  }

  return 'The paid response contains the usable result immediately.'
}

function SchemaCard({
  title,
  schema
}: {
  title: string
  schema: Record<string, string>
}) {
  return (
    <Card className='min-w-0'>
      <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
        {title}
      </p>
      <div className='mt-4 grid gap-3'>
        {Object.entries(schema).map(([field, type]) => (
          <div
            key={field}
            className='border-foreground/10 grid min-w-0 gap-2 rounded-lg border p-4 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]'
          >
            <span className='min-w-0 font-mono text-sm font-semibold break-words'>
              {field}
            </span>
            <span className='text-foreground/70 min-w-0 font-mono text-sm break-words'>
              {type}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function CodeBlock({
  title,
  code,
  copyLabel
}: {
  title: string
  code: string
  copyLabel: string
}) {
  return (
    <div className='min-w-0 space-y-3'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
          {title}
        </p>
        <CopyTextButton text={code} label={copyLabel} />
      </div>
      <pre className='bg-muted max-w-full overflow-x-auto rounded-lg p-4 text-xs leading-6 break-words whitespace-pre-wrap'>
        {code}
      </pre>
    </div>
  )
}
