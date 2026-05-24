import { ConvexHttpClient } from 'convex/browser'
import 'dotenv/config'

import { api } from '../convex/_generated/api'
import type {
  ApiProduct,
  ApiProductCategory
} from '../src/features/marketplace/products'

type PublicToolSeed = {
  slug: string
  name: string
  category: ApiProductCategory
  description: string
  priceUsd: number
  method: 'GET' | 'POST'
  providerEndpointUrl: string
  timeoutSeconds: number
  estimatedLatency: string
  requestSchema: Record<string, string>
  responseSchema: Record<string, string>
  referencePayload: Record<string, unknown>
  featured?: boolean
}

const adminWallet = resolveAdminWallet()
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

if (!convexUrl) {
  throw new Error('Set NEXT_PUBLIC_CONVEX_URL before seeding admin tools.')
}

const client = new ConvexHttpClient(convexUrl)
const profile = await client.mutation(api.users.upsertProfile, {
  walletAddress: adminWallet,
  fullName: process.env.ADMIN_TOOLS_PROVIDER_NAME ?? 'Provider Labs',
  username: process.env.ADMIN_TOOLS_PROVIDER_USERNAME ?? 'platform-labs',
  email: process.env.ADMIN_TOOLS_PROVIDER_EMAIL ?? 'hello@example.com',
  plan: 'plus'
})

if (!profile?._id) {
  throw new Error('Unable to create or load the admin provider profile.')
}

const products = getPublicToolSeeds().map(seed =>
  buildAdminToolProduct(seed, {
    walletAddress: profile.walletAddress as `0x${string}`,
    providerName: profile.fullName,
    providerSlug: profile.username
  })
)

const seeded = []

for (const product of products) {
  const row = await client.mutation(
    api.apiProducts.upsertProviderCatalogProduct,
    {
      userId: profile._id,
      providerSlug: product.providerSlug,
      slug: product.slug,
      name: product.name,
      description: product.description,
      category: product.category,
      priceUsd: product.priceUsd,
      priceLabel: product.priceLabel,
      endpointUrl: product.providerEndpointUrl ?? product.endpointPath,
      method: product.method,
      estimatedLatency: product.estimatedLatency,
      executionMode: product.executionMode,
      settlementModel: product.settlementModel,
      resultDelivery: product.resultDelivery,
      authType: product.providerAuth?.type ?? 'none',
      authHeaderName: product.providerAuth?.headerName,
      authQueryParam: product.providerAuth?.queryParam,
      timeoutSeconds: product.timeoutSeconds,
      requestSchemaJson: JSON.stringify(product.requestSchema),
      responseSchemaJson: JSON.stringify(product.responseSchema),
      demoPayloadJson: JSON.stringify(product.referencePayload),
      productJson: JSON.stringify(product),
      isX402Protected: product.isX402Protected,
      isAgentReady: product.isAgentReady,
      status: product.status
    }
  )

  seeded.push({
    slug: row?.slug ?? product.slug,
    name: product.name,
    providerWallet: product.providerWallet,
    status: row?.status ?? product.status
  })
}

console.log(
  JSON.stringify(
    {
      adminWallet: profile.walletAddress,
      providerName: profile.fullName,
      providerSlug: profile.username,
      seeded
    },
    null,
    2
  )
)

function resolveAdminWallet() {
  const wallet = process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESSES?.split(',')[0]
    ?.trim()
    .toLowerCase()

  if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
    throw new Error(
      'Set NEXT_PUBLIC_ADMIN_WALLET_ADDRESSES to at least one admin wallet before seeding admin tools.'
    )
  }

  return wallet
}

function buildAdminToolProduct(
  seed: PublicToolSeed,
  provider: {
    walletAddress: `0x${string}`
    providerName: string
    providerSlug: string
  }
): ApiProduct {
  return {
    slug: seed.slug,
    name: seed.name,
    ownerWallet: provider.walletAddress,
    providerName: provider.providerName,
    providerSlug: provider.providerSlug,
    providerWallet: provider.walletAddress,
    category: seed.category,
    description: seed.description,
    priceUsd: seed.priceUsd,
    priceLabel: `${seed.priceUsd.toFixed(2)} PYUSD`,
    pricing: { model: 'fixed' },
    method: seed.method,
    endpointPath: `/api/x402/products/${seed.slug}/call`,
    providerEndpointUrl: seed.providerEndpointUrl,
    providerAuth: { type: 'none' },
    timeoutSeconds: seed.timeoutSeconds,
    estimatedLatency: seed.estimatedLatency,
    executionMode: 'synchronous',
    settlementModel: 'pay_on_successful_response',
    resultDelivery: 'direct_response',
    requestSchema: seed.requestSchema,
    responseSchema: seed.responseSchema,
    referencePayload: seed.referencePayload,
    isX402Protected: true,
    isAgentReady: true,
    status: 'published',
    featured: seed.featured,
    calls: 0,
    successRate: 'No calls yet',
    revenueUsdt: '0.00'
  }
}

function getPublicToolSeeds(): PublicToolSeed[] {
  return [
    {
      slug: 'public-wikipedia-context',
      name: 'Wikipedia Context Search',
      category: 'data',
      description:
        'Searches public Wikipedia pages for factual context the agent can use in launch briefs, market summaries, and positioning copy.',
      priceUsd: 0.03,
      method: 'GET',
      providerEndpointUrl: 'https://en.wikipedia.org/w/api.php',
      timeoutSeconds: 20,
      estimatedLatency: '1-3s',
      featured: true,
      requestSchema: {
        action: '"query"',
        list: '"search"',
        format: '"json"',
        srsearch: 'string',
        srlimit: 'number | undefined'
      },
      responseSchema: {
        query: 'object',
        search: 'array',
        searchinfo: 'object'
      },
      referencePayload: {
        action: 'query',
        list: 'search',
        format: 'json',
        srsearch: 'AI API marketplace',
        srlimit: 5,
        origin: '*'
      }
    },
    {
      slug: 'public-openalex-research-scan',
      name: 'OpenAlex Research Scan',
      category: 'data',
      description:
        'Searches the public OpenAlex works index for papers and research metadata that can support technical explainers, documentation, and evidence-backed narratives.',
      priceUsd: 0.04,
      method: 'GET',
      providerEndpointUrl: 'https://api.openalex.org/works',
      timeoutSeconds: 20,
      estimatedLatency: '1-3s',
      requestSchema: {
        search: 'string',
        'per-page': 'number | undefined',
        sort: 'string | undefined'
      },
      responseSchema: {
        meta: 'object',
        results: 'array',
        group_by: 'array'
      },
      referencePayload: {
        search: 'AI agents API payments',
        'per-page': 5,
        sort: 'relevance_score:desc'
      }
    },
    {
      slug: 'public-npm-package-signal',
      name: 'NPM Package Signal',
      category: 'developer',
      description:
        'Searches the public npm registry for package names, descriptions, keywords, maintainers, and popularity signals around a developer product category.',
      priceUsd: 0.04,
      method: 'GET',
      providerEndpointUrl: 'https://registry.npmjs.org/-/v1/search',
      timeoutSeconds: 20,
      estimatedLatency: '1-3s',
      requestSchema: {
        text: 'string',
        size: 'number | undefined',
        quality: 'number | undefined',
        popularity: 'number | undefined',
        maintenance: 'number | undefined'
      },
      responseSchema: {
        objects: 'array',
        total: 'number',
        time: 'string'
      },
      referencePayload: {
        text: 'AI agent API commerce',
        size: 5,
        quality: 0.65,
        popularity: 0.25,
        maintenance: 0.1
      }
    },
    {
      slug: 'public-hn-trend-scan',
      name: 'Hacker News Trend Scan',
      category: 'data',
      description:
        'Searches public Hacker News story metadata for recent developer interest around a launch topic, technology, or market category.',
      priceUsd: 0.04,
      method: 'GET',
      providerEndpointUrl: 'https://hn.algolia.com/api/v1/search_by_date',
      timeoutSeconds: 20,
      estimatedLatency: '1-3s',
      requestSchema: {
        query: 'string',
        tags: 'string | undefined',
        hitsPerPage: 'number | undefined'
      },
      responseSchema: {
        hits: 'array',
        nbHits: 'number',
        page: 'number'
      },
      referencePayload: {
        query: 'AI agents API marketplace',
        tags: 'story',
        hitsPerPage: 5
      }
    },
    {
      slug: 'public-github-repo-search',
      name: 'GitHub Repository Signal',
      category: 'developer',
      description:
        'Searches public GitHub repositories for developer traction signals, related projects, languages, stars, forks, and repo descriptions.',
      priceUsd: 0.04,
      method: 'GET',
      providerEndpointUrl: 'https://api.github.com/search/repositories',
      timeoutSeconds: 20,
      estimatedLatency: '1-3s',
      requestSchema: {
        q: 'string',
        sort: '"stars" | "updated" | undefined',
        order: '"desc" | "asc" | undefined',
        per_page: 'number | undefined'
      },
      responseSchema: {
        total_count: 'number',
        items: 'array',
        incomplete_results: 'boolean'
      },
      referencePayload: {
        q: 'AI agent API marketplace in:name,description,readme',
        sort: 'stars',
        order: 'desc',
        per_page: 5
      }
    },
    {
      slug: 'public-gdelt-news-scan',
      name: 'GDELT News Signal',
      category: 'data',
      description:
        'Searches the public GDELT document API for recent news coverage, article URLs, source domains, and topical language around a product or market.',
      priceUsd: 0.05,
      method: 'GET',
      providerEndpointUrl: 'https://api.gdeltproject.org/api/v2/doc/doc',
      timeoutSeconds: 25,
      estimatedLatency: '2-5s',
      requestSchema: {
        query: 'string',
        mode: '"ArtList"',
        format: '"json"',
        maxrecords: 'number | undefined',
        sort: '"HybridRel" | "DateDesc" | undefined'
      },
      responseSchema: {
        articles: 'array'
      },
      referencePayload: {
        query: 'artificial intelligence agents API payments',
        mode: 'ArtList',
        format: 'json',
        maxrecords: 5,
        sort: 'HybridRel'
      }
    }
  ]
}
