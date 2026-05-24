import type { ApiProductStatus } from '@/features/marketplace/products'
import type { OrderStatus } from '@/features/marketplace/types'

export const productStatusLabels: Record<ApiProductStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  paused: 'Paused'
}

export const orderStatusLabels: Record<OrderStatus, string> = {
  created: 'Created',
  payment_required: 'Payment required',
  quoted: 'Quoted',
  paid: 'Paid',
  forwarding: 'Forwarding',
  processing: 'Processing',
  ready: 'Ready',
  delta_payment_required: 'Delta payment required',
  completed: 'Completed',
  failed: 'Failed',
  expired: 'Expired'
}

export const orderStatusDetails: Record<OrderStatus, string> = {
  created: 'The request has been prepared and is ready for payment.',
  payment_required:
    'The payable request is ready. Run it with the connected wallet or execute the same endpoint from an x402 buyer client, backend, CLI, or autonomous agent.',
  quoted:
    'the gateway priced the request before any expensive provider work starts.',
  paid: 'Payment metadata has been accepted for this request.',
  forwarding: 'the gateway is forwarding the paid request to the provider.',
  processing:
    'The provider accepted the request and is processing the result, or the gateway is holding escrow while retrying a temporary provider outage.',
  ready:
    'The provider finished processing. The result can be released to the buyer.',
  delta_payment_required:
    'The final metered cost is higher than the prepaid quote. Pay the remaining PYUSD before the result is revealed.',
  completed: 'The provider response is ready for the buyer.',
  failed: 'The provider request failed and can be retried with a new request.',
  expired: 'The request window closed before completion.'
}
