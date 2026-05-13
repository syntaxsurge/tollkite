import { z } from 'zod'

const optionalString = z.preprocess(
  value => (value === '' ? undefined : value),
  z.string().optional()
)

const optionalUrl = z.preprocess(
  value => (value === '' ? undefined : value),
  z.string().url().optional()
)

const serverSchema = z.object({
  CONVEX_DEPLOYMENT: optionalString,
  X402_FACILITATOR_URL: optionalUrl,
  NEXT_PUBLIC_API_PAYMENT_ESCROW_ADDRESS: optionalString,
  AGENT_SPENDER_PRIVATE_KEY: optionalString,
  AGENT_ATTESTER_PRIVATE_KEY: optionalString,
  API_ESCROW_OPERATOR_PRIVATE_KEY: optionalString,
  AGENT_RUN_VAULT_OPERATOR_PRIVATE_KEY: optionalString,
  AGENT_LLM_API_KEY: optionalString,
  AGENT_LLM_MODEL: optionalString,
  NODE_ENV: z.enum(['development', 'test', 'production']).optional()
})

export const envServer = serverSchema.parse({
  CONVEX_DEPLOYMENT: process.env.CONVEX_DEPLOYMENT,
  X402_FACILITATOR_URL: process.env.X402_FACILITATOR_URL,
  NEXT_PUBLIC_API_PAYMENT_ESCROW_ADDRESS:
    process.env.NEXT_PUBLIC_API_PAYMENT_ESCROW_ADDRESS,
  AGENT_SPENDER_PRIVATE_KEY: process.env.AGENT_SPENDER_PRIVATE_KEY,
  AGENT_ATTESTER_PRIVATE_KEY: process.env.AGENT_ATTESTER_PRIVATE_KEY,
  API_ESCROW_OPERATOR_PRIVATE_KEY: process.env.API_ESCROW_OPERATOR_PRIVATE_KEY,
  AGENT_RUN_VAULT_OPERATOR_PRIVATE_KEY:
    process.env.AGENT_RUN_VAULT_OPERATOR_PRIVATE_KEY,
  AGENT_LLM_API_KEY: process.env.AGENT_LLM_API_KEY,
  AGENT_LLM_MODEL: process.env.AGENT_LLM_MODEL,
  NODE_ENV: process.env.NODE_ENV
})
