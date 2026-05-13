import type { ApiProduct } from '@/features/marketplace/products'

type ProviderConfiguredProduct = Pick<
  ApiProduct,
  'providerEndpointUrl' | 'providerAuth'
>

export function getProviderConfigurationIssue(
  product: ProviderConfiguredProduct
) {
  if (!product.providerEndpointUrl) {
    return 'Provider endpoint URL is not configured.'
  }

  const auth = product.providerAuth

  if (!auth || auth.type === 'none') {
    return null
  }

  if (
    (auth.type === 'bearer' ||
      auth.type === 'api_key_header' ||
      auth.type === 'api_key_query') &&
    !auth.secret?.trim()
  ) {
    return 'Provider API authentication is not configured. Add the upstream API key before accepting paid requests.'
  }

  if (auth.type === 'basic' && (!auth.username?.trim() || !auth.password)) {
    return 'Provider basic authentication is not configured. Add the upstream username and password before accepting paid requests.'
  }

  return null
}
