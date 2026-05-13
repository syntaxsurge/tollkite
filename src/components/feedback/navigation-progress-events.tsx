'use client'

import { useEffect } from 'react'

import { useTopLoader } from 'nextjs-toploader'

export function NavigationProgressEvents() {
  const topLoader = useTopLoader()

  useEffect(() => {
    function handleSubmit(event: SubmitEvent) {
      if (event.defaultPrevented) {
        return
      }

      const form = event.target

      if (!(form instanceof HTMLFormElement)) {
        return
      }

      if (form.method.toLowerCase() === 'dialog' || form.target === '_blank') {
        return
      }

      const action = form.action || window.location.href

      try {
        const nextUrl = new URL(action, window.location.href)

        if (nextUrl.origin !== window.location.origin) {
          return
        }
      } catch {
        return
      }

      topLoader.start()
    }

    function handleBeforeUnload() {
      topLoader.start()
    }

    function handlePageShow() {
      topLoader.done(true)
    }

    document.addEventListener('submit', handleSubmit)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pageshow', handlePageShow)

    return () => {
      document.removeEventListener('submit', handleSubmit)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [topLoader])

  return null
}
