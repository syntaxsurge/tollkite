import type { NextRequest } from 'next/server'

import type { HTTPAdapter } from '@x402/core/server'

export class NextRequestAdapter implements HTTPAdapter {
  constructor(
    private readonly request: NextRequest,
    private readonly body?: unknown
  ) {}

  getHeader(name: string) {
    return this.request.headers.get(name) ?? undefined
  }

  getMethod() {
    return this.request.method
  }

  getPath() {
    return this.request.nextUrl.pathname
  }

  getUrl() {
    return this.request.url
  }

  getAcceptHeader() {
    return this.request.headers.get('accept') ?? ''
  }

  getUserAgent() {
    return this.request.headers.get('user-agent') ?? ''
  }

  getQueryParams() {
    const params: Record<string, string | string[]> = {}

    for (const [key, value] of this.request.nextUrl.searchParams.entries()) {
      const existing = params[key]

      if (!existing) {
        params[key] = value
      } else if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        params[key] = [existing, value]
      }
    }

    return params
  }

  getQueryParam(name: string) {
    const values = this.request.nextUrl.searchParams.getAll(name)

    if (values.length === 0) {
      return undefined
    }

    return values.length === 1 ? values[0] : values
  }

  getBody() {
    return this.body
  }
}
