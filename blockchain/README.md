# Blockchain Workspace

This workspace keeps app contracts isolated from the Next.js runtime while
providing deployment shortcuts.

## Structure

- `blockchain/contracts/SubscriptionManager.sol` - the on-chain subscription
  contract supported by the app.
- `blockchain/contracts/AgentRunAttestor.sol` - the proof hash attestor
  for autonomous agent runs.
- `blockchain/contracts/ApiPaymentEscrow.sol` - escrow for prepaid
  credit-metered API calls that must be released or refunded after provider
  completion.
- `blockchain/contracts/AgentRunVault.sol` - user-funded PYUSD budget vault for
  autonomous agent runs.
- `blockchain/hardhat.config.ts` - Hardhat configuration for the configured
  EVM deployment target.
- `blockchain/scripts/deploySubscriptionManager.ts` - deployment script that
  writes the deployed address to `blockchain/deployment.log`.
- `blockchain/scripts/deployAgentRunAttestor.ts` - deployment script that
  prints `NEXT_PUBLIC_AGENT_ATTESTOR_ADDRESS`.
- `blockchain/scripts/deployApiPaymentEscrow.ts` - deployment script that prints
  `NEXT_PUBLIC_API_PAYMENT_ESCROW_ADDRESS`.
- `blockchain/scripts/deployAgentRunVault.ts` - deployment script that prints
  `NEXT_PUBLIC_AGENT_RUN_VAULT_ADDRESS`.
- `src/lib/contracts/` - frontend-facing subscription ABI and address helpers.

## Setup

1. Copy `blockchain/.env.example` to `blockchain/.env` and fill in RPC,
   deployer, admin, and platform addresses.
2. Install dependencies from the blockchain workspace.
3. Compile and deploy the subscription, agent attestor, API payment escrow, and
   agent run vault contracts.

```bash
cd blockchain
pnpm install
pnpm compile
pnpm deploy:subscription
pnpm deploy:agent-attestor
pnpm deploy:api-escrow
pnpm deploy:agent-vault
```

## Notes

- Copy `NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS` from
  `blockchain/deployment.log` into the root `.env.local` after deployment.
- Copy `NEXT_PUBLIC_AGENT_ATTESTOR_ADDRESS` from the attestor deployment output
  into the root `.env.local` after deployment.
- Copy `NEXT_PUBLIC_API_PAYMENT_ESCROW_ADDRESS` from the escrow deployment
  output into the root `.env.local` after deployment, then set
  `API_ESCROW_OPERATOR_PRIVATE_KEY` to an account with `OPERATOR_ROLE`.
- Copy `NEXT_PUBLIC_AGENT_RUN_VAULT_ADDRESS` from the vault deployment output
  into the root `.env.local` after deployment, then set
  `AGENT_RUN_VAULT_OPERATOR_PRIVATE_KEY` to an account with `OPERATOR_ROLE`.
- Avoid importing from `blockchain/**` in the Next.js runtime.
