import { z } from 'zod'

export const createAgentRunSchema = z
  .object({
    template: z.string().trim().min(2).optional(),
    objective: z.string().min(12),
    sourceText: z.string().optional(),
    ownerWallet: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, 'Connect a valid 0x wallet address.'),
    budgetCapUsdt: z.coerce.number().positive().max(100),
    maxPaidActions: z.coerce.number().int().min(1).max(4),
    toolSelectionMode: z.enum(['ai', 'manual']).optional().default('ai'),
    allowedTools: z.array(z.string().trim().min(3)).max(12).optional(),
    mode: z.literal('production').optional().default('production')
  })
  .superRefine((value, context) => {
    if (value.toolSelectionMode === 'manual' && !value.allowedTools?.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['allowedTools'],
        message: 'Select at least one tool for manual tool selection.'
      })
    }
  })
