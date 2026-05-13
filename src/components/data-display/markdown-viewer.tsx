'use client'

import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { cn } from '@/lib/utils/cn'

type MarkdownViewerProps = {
  value: string
  className?: string
}

export function MarkdownViewer({ value, className }: MarkdownViewerProps) {
  return (
    <div className={cn('text-foreground/80 max-w-none', className)}>
      <ReactMarkdown
        components={markdownComponents}
        remarkPlugins={[remarkGfm]}
      >
        {value}
      </ReactMarkdown>
    </div>
  )
}

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className='text-foreground/75 my-3 text-sm leading-7'>{children}</p>
  ),
  h1: ({ children }) => (
    <h2 className='font-display text-foreground mt-2 text-2xl leading-tight'>
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h3 className='font-display text-foreground mt-7 text-xl leading-tight'>
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className='text-foreground mt-5 text-base font-semibold'>{children}</h4>
  ),
  ul: ({ children }) => (
    <ul className='text-foreground/75 my-3 list-disc space-y-2 pl-5 text-sm leading-7'>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className='text-foreground/75 my-3 list-decimal space-y-2 pl-5 text-sm leading-7'>
      {children}
    </ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => (
    <strong className='text-foreground font-semibold'>{children}</strong>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-')

    if (isBlock) {
      return <code className={className}>{children}</code>
    }

    return (
      <code className='bg-muted text-foreground rounded px-1.5 py-0.5 text-[0.85em]'>
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className='bg-muted text-foreground my-4 max-w-full overflow-auto rounded-lg p-4 text-xs leading-6'>
      {children}
    </pre>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target='_blank'
      rel='noreferrer'
      className='text-primary font-semibold underline-offset-4 hover:underline'
    >
      {children}
    </a>
  )
}
