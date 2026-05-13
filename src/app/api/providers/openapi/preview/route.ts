import { NextResponse } from 'next/server'

import { z } from 'zod'

import {
  createOpenApiImportCandidates,
  parseOpenApiDocument
} from '@/features/marketplace/openapi-import'

export const dynamic = 'force-dynamic'

const openApiPreviewSchema = z
  .object({
    specUrl: z.string().trim().url().optional().or(z.literal('')),
    specText: z.string().trim().optional(),
    baseUrl: z.string().trim().url().optional().or(z.literal(''))
  })
  .refine(input => input.specUrl || input.specText, {
    message: 'Provide an OpenAPI URL or pasted OpenAPI document.'
  })

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = openApiPreviewSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid OpenAPI import request.',
        issues: parsed.error.flatten().fieldErrors
      },
      { status: 400 }
    )
  }

  try {
    const specText =
      parsed.data.specText || (await fetchSpec(parsed.data.specUrl))
    const document = parseOpenApiDocument(specText)
    const candidates = createOpenApiImportCandidates({
      document,
      sourceUrl: parsed.data.specUrl || undefined,
      baseUrl: parsed.data.baseUrl || undefined
    })

    return NextResponse.json({
      info: {
        title: document.info?.title ?? 'OpenAPI document',
        operationCount: candidates.length
      },
      candidates
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to parse the OpenAPI document.'
      },
      { status: 400 }
    )
  }
}

async function fetchSpec(specUrl?: string) {
  if (!specUrl) {
    return ''
  }

  const response = await fetch(specUrl, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json, application/yaml, text/yaml, text/plain',
      'Cache-Control': 'no-cache'
    }
  })

  if (!response.ok) {
    throw new Error(`OpenAPI URL returned HTTP ${response.status}.`)
  }

  return response.text()
}
