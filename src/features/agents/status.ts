import type { AgentActionStatus, AgentRunStatus } from '@/features/agents/types'

export const agentRunStatusLabels: Record<AgentRunStatus, string> = {
  planned: 'Planned',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  attesting: 'Attesting',
  attested: 'Attested'
}

export const agentActionStatusLabels: Record<AgentActionStatus, string> = {
  planned: 'Planned',
  quoted: 'Quoted',
  paid: 'Paid',
  completed: 'Completed',
  skipped: 'Skipped',
  failed: 'Failed'
}

export const agentRunStatusDetails: Record<AgentRunStatus, string> = {
  planned:
    'The agent has an objective, budget, and allowed tool set, but has not started paid work.',
  running:
    'The agent is selecting tools, making paid x402 calls, and collecting receipts.',
  completed:
    'The agent finished the task and prepared a proof package for attestation.',
  failed:
    'The agent could not complete one or more required paid actions within the selected configuration.',
  attesting:
    'The proof hash is being written to the configured attestor contract.',
  attested:
    'The proof hash has an on-chain transaction and can be audited from the public proof page.'
}
