import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ToastProps {
  title?: string
  description?: string
  action?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onDismiss?: () => void
  className?: string
}

interface ToastState {
  id: string
  title?: string
  description?: string
  action?: React.ReactNode
  open: boolean
  onDismiss?: () => void
}

let listener: ((toasts: ToastState[]) => void) | null = null

const toasts: ToastState[] = []

function addToast(toast: Omit<ToastState, 'id' | 'open'>) {
  const id = crypto.randomUUID?.() || `toast_${Date.now()}`
  const newToast = { ...toast, id, open: true }
  toasts.push(newToast)
  if (listener) listener([...toasts])
  return id
}

function dismissToast(id: string) {
  const index = toasts.findIndex((t) => t.id === id)
  if (index === -1) return
  toasts[index].open = false
  setTimeout(() => {
    const i = toasts.findIndex((t) => t.id === id)
    if (i !== -1) toasts.splice(i, 1)
    if (listener) listener([...toasts])
  }, 300)
  if (listener) listener([...toasts])
}

function subscribe(callback: (toasts: ToastState[]) => void) {
  listener = callback
  return () => {
    listener = null
  }
}

export { addToast, dismissToast, subscribe }

export const Toast = React.forwardRef<HTMLDivElement, ToastProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'pointer-events-auto relative flex items-center gap-4 overflow-hidden border border-line bg-paper text-ink shadow-lg',
      className,
    )}
    {...props}
  />
))
Toast.displayName = 'Toast'
