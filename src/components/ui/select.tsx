import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex h-10 w-full items-center rounded-md border border-line bg-cream px-3 py-2 text-ink text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
))
Select.displayName = 'Select'

export { Select }
