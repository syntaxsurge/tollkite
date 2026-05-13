export type ProviderAdapterInput = {
  productSlug: string
  orderId: string
  requestId: string
  providerIdempotencyKey?: string
  requestPayload: unknown
  buyerWallet: string
  receiptId: string
}

export type ProviderAdapterResult = {
  status: 'completed' | 'processing' | 'failed'
  responsePayload?: unknown
  externalJobId?: string
  resultUrl?: string
  errorMessage?: string
  providerRequest?: ProviderRequestTrace
}

export type ProviderRequestTrace = {
  method: 'GET' | 'POST'
  url: string
  requestHeaders: Record<string, string>
  requestQuery?: Record<string, string>
  requestBody?: unknown
  responseStatus?: number
  responseStatusText?: string
  responseHeaders?: Record<string, string>
  responseBody?: unknown
  error?: string
}

export interface ProviderAdapter {
  id: string
  call(input: ProviderAdapterInput): Promise<ProviderAdapterResult>
  getStatus?(
    externalJobId: string,
    productSlug?: string
  ): Promise<ProviderAdapterResult>
}
