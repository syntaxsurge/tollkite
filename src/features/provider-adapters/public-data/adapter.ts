import type {
  ProviderAdapter,
  ProviderAdapterInput,
  ProviderAdapterResult
} from '@/features/provider-adapters/types'

const PUBLIC_DATA_TIMEOUT_MS = 15_000
export const publicDataProductSlugs = new Set([
  'public-wikipedia-context',
  'public-hn-trend-scan',
  'public-github-repo-search',
  'public-npm-package-signal',
  'public-openalex-research-scan',
  'public-gdelt-news-scan'
])

type FetchJsonResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; data: unknown; message: string }

export const publicDataAdapter: ProviderAdapter = {
  id: 'public-data',
  async call(input) {
    switch (input.productSlug) {
      case 'public-wikipedia-context':
        return callWikipedia(input)
      case 'public-hn-trend-scan':
        return callHackerNews(input)
      case 'public-github-repo-search':
        return callGitHub(input)
      case 'public-npm-package-signal':
        return callNpm(input)
      case 'public-openalex-research-scan':
        return callOpenAlex(input)
      case 'public-gdelt-news-scan':
        return callGdelt(input)
      default:
        return {
          status: 'failed',
          errorMessage: 'Public data adapter does not support this product.'
        }
    }
  }
}

async function callWikipedia(input: ProviderAdapterInput) {
  const payload = asRecord(input.requestPayload)
  const url = new URL('https://en.wikipedia.org/w/api.php')

  setSearchParams(url, {
    action: getString(payload.action, 'query'),
    list: getString(payload.list, 'search'),
    format: getString(payload.format, 'json'),
    srsearch: getString(payload.srsearch, getString(payload.query, 'API')),
    srlimit: getNumber(payload.srlimit, 5),
    origin: '*'
  })

  return completeFromFetch(await fetchJson(url), 'Wikipedia request failed.')
}

async function callHackerNews(input: ProviderAdapterInput) {
  const payload = asRecord(input.requestPayload)
  const url = new URL('https://hn.algolia.com/api/v1/search_by_date')

  setSearchParams(url, {
    query: getString(payload.query, 'AI agents API marketplace'),
    tags: getString(payload.tags, 'story'),
    hitsPerPage: getNumber(payload.hitsPerPage, 5)
  })

  return completeFromFetch(await fetchJson(url), 'Hacker News request failed.')
}

async function callGitHub(input: ProviderAdapterInput) {
  const payload = asRecord(input.requestPayload)
  const query = getString(payload.q, 'AI agent API marketplace')
  const url = new URL('https://api.github.com/search/repositories')

  setSearchParams(url, {
    q: query,
    sort: getString(payload.sort, 'stars'),
    order: getString(payload.order, 'desc'),
    per_page: getNumber(payload.per_page, 5)
  })

  const primary = await fetchJson(url)

  if (primary.ok) {
    return completeFromFetch(primary, 'GitHub request failed.')
  }

  return fallbackGitLabProjects(query, getNumber(payload.per_page, 5), primary)
}

async function callNpm(input: ProviderAdapterInput) {
  const payload = asRecord(input.requestPayload)
  const url = new URL('https://registry.npmjs.org/-/v1/search')

  setSearchParams(url, {
    text: getString(payload.text, 'AI agent API commerce'),
    size: getNumber(payload.size, 5),
    quality: getNumber(payload.quality, 0.65),
    popularity: getNumber(payload.popularity, 0.25),
    maintenance: getNumber(payload.maintenance, 0.1)
  })

  return completeFromFetch(await fetchJson(url), 'npm request failed.')
}

async function callOpenAlex(input: ProviderAdapterInput) {
  const payload = asRecord(input.requestPayload)
  const search = getString(payload.search, 'AI agents API payments')
  const perPage = getNumber(payload['per-page'], 5)
  const url = new URL('https://api.openalex.org/works')

  setSearchParams(url, {
    search,
    'per-page': perPage,
    sort: getString(payload.sort, 'relevance_score:desc')
  })

  const primary = await fetchJson(url)

  if (primary.ok) {
    return completeFromFetch(primary, 'OpenAlex request failed.')
  }

  return fallbackCrossrefWorks(search, perPage, primary)
}

async function callGdelt(input: ProviderAdapterInput) {
  const payload = asRecord(input.requestPayload)
  const rawQuery = getString(
    payload.query,
    'artificial intelligence agents API payments'
  )
  const query = normalizeGdeltQuery(rawQuery)
  const maxrecords = getNumber(payload.maxrecords, 5)
  const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc')

  setSearchParams(url, {
    query,
    mode: getString(payload.mode, 'ArtList'),
    format: getString(payload.format, 'json'),
    maxrecords,
    sort: getString(payload.sort, 'HybridRel')
  })

  const primary = await fetchJson(url)

  if (primary.ok && hasGdeltArticles(primary.data)) {
    return completeFromFetch(primary, 'GDELT request failed.')
  }

  return fallbackHackerNewsArticles(
    rawQuery,
    maxrecords,
    primary.ok
      ? {
          ok: false,
          status: primary.status,
          data: primary.data,
          message: 'GDELT returned no usable article list.'
        }
      : primary
  )
}

async function fallbackGitLabProjects(
  query: string,
  perPage: number,
  primaryFailure: FetchJsonResult
): Promise<ProviderAdapterResult> {
  const url = new URL('https://gitlab.com/api/v4/projects')

  setSearchParams(url, {
    search: query,
    per_page: perPage,
    order_by: 'star_count',
    sort: 'desc',
    simple: 'true'
  })

  const fallback = await fetchJson(url)

  if (!fallback.ok || !Array.isArray(fallback.data)) {
    return failedWithFallback(
      'GitHub request failed.',
      primaryFailure,
      fallback
    )
  }

  return {
    status: 'completed',
    responsePayload: {
      total_count: fallback.data.length,
      incomplete_results: false,
      fallbackSource: 'gitlab',
      items: fallback.data.map(project => {
        const record = asRecord(project)

        return {
          id: record.id,
          name: record.name,
          full_name: record.path_with_namespace,
          html_url: record.web_url,
          description: record.description,
          stargazers_count: record.star_count,
          forks_count: record.forks_count,
          language: null,
          source: 'GitLab public projects'
        }
      })
    }
  }
}

async function fallbackCrossrefWorks(
  query: string,
  rows: number,
  primaryFailure: FetchJsonResult
): Promise<ProviderAdapterResult> {
  const url = new URL('https://api.crossref.org/works')

  setSearchParams(url, {
    query,
    rows
  })

  const fallback = await fetchJson(url)
  const message = asRecord(fallback.ok ? fallback.data : {}).message
  const items = asRecord(message).items

  if (!fallback.ok || !Array.isArray(items)) {
    return failedWithFallback(
      'OpenAlex request failed.',
      primaryFailure,
      fallback
    )
  }

  return {
    status: 'completed',
    responsePayload: {
      meta: {
        count: items.length,
        fallbackSource: 'crossref'
      },
      results: items.map(item => {
        const record = asRecord(item)
        const title = Array.isArray(record.title) ? record.title[0] : undefined

        return {
          id: record.URL,
          doi: record.DOI,
          display_name: title,
          publication_year: getIssuedYear(record.issued),
          cited_by_count: record['is-referenced-by-count'],
          source: 'Crossref public works'
        }
      }),
      group_by: []
    }
  }
}

async function fallbackHackerNewsArticles(
  query: string,
  hitsPerPage: number,
  primaryFailure: FetchJsonResult
): Promise<ProviderAdapterResult> {
  const fallbackQueries = [
    query,
    query.replace(/\bartificial intelligence\b/gi, 'AI'),
    'AI agents API payments'
  ].filter((value, index, values) => value && values.indexOf(value) === index)

  let fallback: FetchJsonResult | undefined
  let hits: unknown[] = []

  for (const fallbackQuery of fallbackQueries) {
    const url = new URL('https://hn.algolia.com/api/v1/search_by_date')

    setSearchParams(url, {
      query: fallbackQuery,
      tags: 'story',
      hitsPerPage
    })

    fallback = await fetchJson(url)

    const candidateHits = asRecord(fallback.ok ? fallback.data : {}).hits

    if (
      fallback.ok &&
      Array.isArray(candidateHits) &&
      candidateHits.length > 0
    ) {
      hits = candidateHits
      break
    }
  }

  if (!fallback || !fallback.ok || hits.length === 0) {
    return failedWithFallback(
      'GDELT request failed.',
      primaryFailure,
      fallback ?? {
        ok: false,
        status: 0,
        data: null,
        message: 'No fallback request was attempted.'
      }
    )
  }

  return {
    status: 'completed',
    responsePayload: {
      articles: hits.map(hit => {
        const record = asRecord(hit)
        const urlValue =
          getString(record.url, '') ||
          `https://news.ycombinator.com/item?id=${record.objectID}`

        return {
          url: urlValue,
          title: record.title ?? record.story_title,
          seendate: record.created_at,
          domain: safeDomain(urlValue),
          language: 'English',
          sourceCountry: 'US',
          fallbackSource: 'Hacker News Algolia'
        }
      }),
      fallbackSource: 'hacker-news-algolia',
      primaryFailure: primaryFailure.data
    }
  }
}

function completeFromFetch(
  result: FetchJsonResult,
  fallbackMessage: string
): ProviderAdapterResult {
  if (result.ok) {
    return {
      status: 'completed',
      responsePayload: result.data
    }
  }

  return {
    status: 'failed',
    errorMessage: `${fallbackMessage} ${result.message}`,
    responsePayload: result.data
  }
}

function failedWithFallback(
  message: string,
  primary: FetchJsonResult,
  fallback: FetchJsonResult
): ProviderAdapterResult {
  return {
    status: 'failed',
    errorMessage: `${message} Primary and fallback public data sources failed.`,
    responsePayload: {
      primary,
      fallback
    }
  }
}

async function fetchJson(url: URL): Promise<FetchJsonResult> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'API commerce public-data gateway (https://platform.com)'
      },
      signal: AbortSignal.timeout(PUBLIC_DATA_TIMEOUT_MS)
    })
    const contentType = response.headers.get('content-type') ?? ''
    const data = contentType.includes('application/json')
      ? ((await response.json().catch(() => null)) as unknown)
      : parseMaybeJson(await response.text().catch(() => ''))

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data,
        message: `HTTP ${response.status}`
      }
    }

    return { ok: true, status: response.status, data }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      message: error instanceof Error ? error.message : 'Request failed.'
    }
  }
}

function parseMaybeJson(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return { body: value }
  }
}

function setSearchParams(
  url: URL,
  params: Record<string, string | number | undefined>
) {
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })
}

function normalizeGdeltQuery(query: string) {
  const normalized = query
    .split(/\s+/)
    .flatMap(term => {
      const cleanTerm = term.replace(/[^\p{L}\p{N}]/gu, '')

      if (/^ai$/i.test(cleanTerm)) {
        return ['artificial', 'intelligence']
      }

      if (cleanTerm.length > 0 && cleanTerm.length < 3) {
        return []
      }

      return [term]
    })
    .join(' ')
    .trim()

  return normalized || 'artificial intelligence agents API payments'
}

function hasGdeltArticles(value: unknown) {
  const articles = asRecord(value).articles

  return Array.isArray(articles) && articles.length > 0
}

function getIssuedYear(value: unknown) {
  const issued = asRecord(value)
  const dateParts = issued['date-parts']

  if (!Array.isArray(dateParts) || !Array.isArray(dateParts[0])) {
    return undefined
  }

  return dateParts[0][0]
}

function safeDomain(value: string) {
  try {
    return new URL(value).hostname
  } catch {
    return ''
  }
}

function getString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function getNumber(value: unknown, fallback: number) {
  const numberValue = Number(value)

  return Number.isFinite(numberValue) ? numberValue : fallback
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
