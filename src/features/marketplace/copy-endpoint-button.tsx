'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'

type CopyTextButtonProps = {
  text: string
  label?: string
  copiedLabel?: string
}

export function CopyTextButton({
  text,
  label = 'Copy',
  copiedLabel = 'Copied'
}: CopyTextButtonProps) {
  const [copied, setCopied] = useState(false)

  async function copyText() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <Button type='button' variant='outline' size='sm' onClick={copyText}>
      {copied ? copiedLabel : label}
    </Button>
  )
}

export function CopyEndpointButton({ endpoint }: { endpoint: string }) {
  return <CopyTextButton text={endpoint} label='Copy endpoint' />
}
