import * as React from 'react'

import { cn } from '@/lib/utils/cn'

type ButtonVariant = 'primary' | 'outline' | 'ghost'

type ButtonSize = 'sm' | 'md' | 'lg'

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

const baseStyles =
  'inline-flex items-center justify-center gap-2 rounded-lg text-center font-semibold whitespace-nowrap transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:translate-y-0 disabled:shadow-none'

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground shadow-sm shadow-brand-blue/20 hover:bg-primary/90 hover:translate-y-[-1px] hover:shadow-md hover:shadow-brand-blue/25 active:translate-y-0 active:shadow-sm disabled:bg-muted disabled:text-muted-foreground disabled:hover:bg-muted',
  outline:
    'border border-border bg-card/80 text-foreground shadow-sm hover:border-brand-cyan/70 hover:bg-accent/10 disabled:bg-muted/40 disabled:text-muted-foreground disabled:hover:border-border disabled:hover:bg-muted/40',
  ghost:
    'text-foreground hover:bg-accent/10 hover:text-primary disabled:text-muted-foreground disabled:hover:bg-transparent'
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-4 py-2 text-sm leading-5',
  md: 'min-h-11 px-6 py-2.5 text-sm leading-5',
  lg: 'min-h-12 px-7 py-3 text-base leading-6'
}

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  className
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}) {
  return cn(baseStyles, variantStyles[variant], sizeStyles[size], className)
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  )
)

Button.displayName = 'Button'
