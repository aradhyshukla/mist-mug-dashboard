import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'brand' | 'brand-ghost' | 'brand-gold' | 'outline' | 'destructive' | 'secondary' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const Comp = asChild ? React.Fragment : 'button'

    const variants = {
      default: 'bg-forest text-paper border border-forest hover:bg-forestSoft',
      brand: 'bg-forest text-paper border border-forest hover:bg-forestSoft',
      'brand-ghost': 'bg-transparent text-forest border border-forest hover:bg-forestSoft hover:text-paper',
      'brand-gold': 'bg-gold text-coffee border border-gold hover:bg-[#d99644]',
      outline: 'border border-border bg-paperSoft text-ink hover:bg-paperSoft/80',
      destructive: 'bg-terracotta text-paper border border-terracotta hover:bg-[#b86a4f]',
      secondary: 'bg-paperSoft text-ink border border-border hover:bg-paperSoft/80',
      ghost: 'hover:bg-paperSoft hover:text-forest',
    }

    const sizes = {
      default: 'h-10 px-4 py-2.5 text-sm rounded-lg',
      sm: 'h-9 px-3 py-2 text-xs rounded-lg',
      lg: 'h-11 px-8 text-base rounded-lg',
    }

    return (
      <Comp
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paperSoft disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]',
          variants[variant],
          sizes[size],
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button }
