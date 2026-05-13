'use client'

import Link from 'next/link'
import { useState } from 'react'

import { Loader2, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { agentRunStatusLabels } from '@/features/agents/status'
import type { AgentRun } from '@/features/agents/types'

export function AgentRunList({ runs: initialRuns }: { runs: AgentRun[] }) {
  const [runs, setRuns] = useState(initialRuns)
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function deleteRun(runId: string) {
    setError('')
    setDeletingRunId(runId)

    try {
      const response = await fetch(`/api/agents/runs/${runId}`, {
        method: 'DELETE'
      })
      const body = (await response.json().catch(() => null)) as {
        error?: string
      } | null

      if (!response.ok) {
        throw new Error(body?.error ?? 'Unable to delete this agent run.')
      }

      window.sessionStorage.removeItem(`app:agent-run:${runId}`)
      setRuns(current => current.filter(run => run.id !== runId))
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to delete this agent run.'
      )
    } finally {
      setDeletingRunId(null)
    }
  }

  if (runs.length === 0) {
    return (
      <div className='border-foreground/10 bg-muted/30 rounded-lg border p-5 text-sm'>
        <p className='font-semibold'>No runs yet</p>
        <p className='text-foreground/65 mt-1'>
          Create a run to test OpenAI planning, x402 settlement, and on-chain
          proof output.
        </p>
      </div>
    )
  }

  return (
    <div className='grid gap-3'>
      {error ? (
        <p
          className='rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300'
          role='alert'
        >
          {error}
        </p>
      ) : null}
      {runs.map(run => (
        <div
          key={run.id}
          className='border-foreground/10 hover:border-primary/50 hover:bg-muted/35 grid gap-3 rounded-lg border p-4 transition sm:grid-cols-[1fr_auto] sm:items-center'
        >
          <Link href={`/agents/${run.id}`} className='min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='truncate font-semibold'>{run.title}</span>
              <span className='bg-muted text-foreground/70 rounded-md px-2 py-0.5 text-xs'>
                {run.actions.length} actions
              </span>
              <span className='text-primary text-sm font-semibold'>
                {agentRunStatusLabels[run.status]}
              </span>
            </div>
            <p className='text-foreground/60 mt-1 line-clamp-2 text-sm leading-6'>
              {run.objective}
            </p>
          </Link>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='justify-self-start text-red-600 hover:border-red-500/50 hover:bg-red-500/10 sm:justify-self-end dark:text-red-300'
            disabled={deletingRunId === run.id}
            onClick={() => void deleteRun(run.id)}
          >
            {deletingRunId === run.id ? (
              <Loader2 className='h-4 w-4 animate-spin' aria-hidden />
            ) : (
              <Trash2 className='h-4 w-4' aria-hidden />
            )}
            Delete
          </Button>
        </div>
      ))}
    </div>
  )
}
