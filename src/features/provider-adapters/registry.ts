import { getProductBySlug } from '@/features/marketplace/products'
import { externalHttpAdapter } from '@/features/provider-adapters/external-http/adapter'
import {
  publicDataAdapter,
  publicDataProductSlugs
} from '@/features/provider-adapters/public-data/adapter'

export async function getProviderAdapter(productSlug: string) {
  const product = await getProductBySlug(productSlug)

  if (publicDataProductSlugs.has(productSlug)) {
    return publicDataAdapter
  }

  return product?.providerEndpointUrl ? externalHttpAdapter : undefined
}

export function listProviderAdapters() {
  return [publicDataAdapter, externalHttpAdapter]
}
