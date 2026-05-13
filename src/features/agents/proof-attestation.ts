import { createHash } from 'node:crypto'

import {
  createWalletClient,
  http,
  parseAbi,
  type Address,
  type Hex
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import type { AgentProof, AgentRun } from '@/features/agents/types'
import { appChains, getExplorerTransactionUrl } from '@/lib/config/chains'
import { envClient } from '@/lib/env/env.client'
import { envServer } from '@/lib/env/env.server'

export const agentRunAttestorAbi = parseAbi([
  'function attestRun(bytes32 runId, address ownerWallet, bytes32 proofHash, string proofUri) returns (bytes32)',
  'function proofOf(bytes32 runId) view returns (address ownerWallet, bytes32 proofHash, string proofUri, uint256 attestedAt)',
  'event AgentRunAttested(bytes32 indexed runId, address indexed ownerWallet, bytes32 proofHash, string proofUri)'
])

export async function attestAgentRunOnChain(
  run: AgentRun,
  proof: Omit<AgentProof, 'txHash' | 'explorerUrl'>
) {
  const contractAddress = envClient.NEXT_PUBLIC_AGENT_ATTESTOR_ADDRESS
  const privateKey = envServer.AGENT_ATTESTER_PRIVATE_KEY

  if (!contractAddress || !privateKey) {
    return {
      txHash: null,
      explorerUrl: null
    }
  }

  const account = privateKeyToAccount(privateKey as Hex)
  const walletClient = createWalletClient({
    account,
    chain: appChains.app.viemChain,
    transport: http(appChains.app.viemChain.rpcUrls.default.http[0])
  })

  const txHash = await walletClient.writeContract({
    address: contractAddress as Address,
    abi: agentRunAttestorAbi,
    functionName: 'attestRun',
    args: [
      proofHashToBytes32(run.id),
      run.ownerWallet as Address,
      proof.proofHash,
      proof.proofUri
    ]
  })

  return {
    txHash,
    explorerUrl: getExplorerTransactionUrl(txHash, appChains.app.id)
  }
}

function proofHashToBytes32(value: string): `0x${string}` {
  return `0x${createHash('sha256').update(value).digest('hex')}`
}
