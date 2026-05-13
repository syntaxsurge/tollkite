'use client'

import { useEffect, useRef } from 'react'

type UseAutoPollingOptions = {
  enabled: boolean
  intervalMs: number
  immediate?: boolean
  onPoll: () => Promise<void> | void
}

export function useAutoPolling({
  enabled,
  intervalMs,
  immediate = true,
  onPoll
}: UseAutoPollingOptions) {
  const onPollRef = useRef(onPoll)
  const inFlightRef = useRef(false)

  useEffect(() => {
    onPollRef.current = onPoll
  }, [onPoll])

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false
    const poll = async () => {
      if (cancelled || inFlightRef.current) {
        return
      }

      inFlightRef.current = true

      try {
        await onPollRef.current()
      } finally {
        inFlightRef.current = false
      }
    }

    if (immediate) {
      void poll()
    }

    const interval = window.setInterval(() => {
      void poll()
    }, intervalMs)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [enabled, immediate, intervalMs])
}
