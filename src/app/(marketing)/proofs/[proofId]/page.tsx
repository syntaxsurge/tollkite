import Link from 'next/link'
import { notFound } from 'next/navigation'

import { JsonViewer } from '@/components/data-display/json-viewer'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getAgentProof, listAgentRuns } from '@/features/agents/store'

type ProofPageProps = {
  params: Promise<{
    proofId: string
  }>
}

export default async function ProofPage({ params }: ProofPageProps) {
  const { proofId } = await params
  const proof = await getAgentProof(proofId)

  if (!proof) {
    notFound()
  }

  const run = (await listAgentRuns()).find(item => item.id === proof.runId)

  return (
    <div className='container-page space-y-8 py-16'>
      <section className='bg-panel-sheen border-foreground/10 rounded-lg border p-6'>
        <Badge>Public Kite proof</Badge>
        <div className='mt-4 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end'>
          <div className='space-y-3'>
            <h1 className='font-display text-4xl'>Agent run proof</h1>
            <p className='text-foreground/70 max-w-2xl text-sm leading-6'>
              This page lets buyers, providers, and external reviewers audit
              what the agent did without exposing private prompts or full
              provider responses on-chain.
            </p>
          </div>
          <Card className='bg-background/85'>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              Network
            </p>
            <p className='mt-2 text-2xl font-semibold'>{proof.network}</p>
            <p className='text-foreground/65 mt-2 text-sm leading-6'>
              Proof hash and transaction metadata are anchored to Kite.
            </p>
          </Card>
        </div>
      </section>

      <section className='grid gap-5 xl:grid-cols-[1fr_0.8fr]'>
        <Card className='space-y-4'>
          {[
            ['Proof ID', proof.id],
            ['Run ID', proof.runId],
            ['Owner wallet', proof.ownerWallet],
            ['Proof hash', proof.proofHash],
            ['Total spend', `${proof.totalSpendUsdt} USDT`],
            ['Funded budget', run?.fundedAmountUsdt ?? 'Not available'],
            ['Refunded budget', run?.refundedAmountUsdt ?? 'Not available'],
            [
              'Receipts',
              proof.receiptIds.length > 0
                ? proof.receiptIds.join(', ')
                : 'No USDT receipt records attached'
            ]
          ].map(([label, value]) => (
            <div key={label}>
              <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
                {label}
              </p>
              <p className='mt-1 text-sm font-semibold break-words'>{value}</p>
            </div>
          ))}
        </Card>
        <Card className='space-y-4'>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Attestation
          </p>
          <p className='font-mono text-sm break-words'>
            {proof.txHash ?? 'Awaiting on-chain attestation transaction'}
          </p>
          {proof.explorerUrl ? (
            <a
              href={proof.explorerUrl}
              target='_blank'
              rel='noreferrer'
              className={buttonClasses({ variant: 'primary', size: 'sm' })}
            >
              View on Kite Explorer
            </a>
          ) : null}
          {run ? (
            <Link
              href={`/agents/${run.id}`}
              className={buttonClasses({ variant: 'outline', size: 'sm' })}
            >
              Open agent run
            </Link>
          ) : null}
        </Card>
      </section>

      {run ? (
        <Card className='space-y-4'>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Public run summary
          </p>
          <h2 className='font-display mt-3 text-2xl'>{run.title}</h2>
          <p className='text-foreground/70 mt-3 text-sm leading-6'>
            {run.summary}
          </p>
          <div className='grid gap-3 md:grid-cols-3'>
            {[
              ['Vault', run.vaultAddress ?? 'Not configured'],
              ['Funding tx', run.fundingTxHash ?? 'Not recorded'],
              ['Refund tx', run.refundTxHash ?? 'Not recorded']
            ].map(([label, value]) => (
              <div
                key={label}
                className='border-border bg-muted/30 rounded-lg border p-3'
              >
                <p className='text-foreground/60 text-xs tracking-[0.14em] uppercase'>
                  {label}
                </p>
                <p className='mt-1 text-sm font-semibold break-words'>
                  {value}
                </p>
              </div>
            ))}
          </div>
          <JsonViewer
            title='Public deliverables JSON'
            value={run.deliverables}
            copyLabel='Copy deliverables'
          />
        </Card>
      ) : null}
    </div>
  )
}
