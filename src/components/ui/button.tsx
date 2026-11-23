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
      default: 'bg-forest text-cream hover:bg-[#0e2018] border border-forest',
      brand: 'bg-forest text-cream hover:bg-[#0e2018] border border-forest',
      'brand-ghost': 'bg-transparent text-forest border border-forest hover:bg-forest hover:text-cream',
      'brand-gold': 'bg-gold text-coffee hover:bg-[#e2a24a] border border-gold',
      outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 border border-destructive',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border',
      ghost: 'hover:bg-accent hover:text-accent-foreground',
    }

    const sizes = {
      default: 'h-10 px-4 py-2 text-sm',
      sm: 'h-9 px-3 text-xs',
      lg: 'h-11 px-8 text-base',
    }

    return (
      <Comp
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
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
