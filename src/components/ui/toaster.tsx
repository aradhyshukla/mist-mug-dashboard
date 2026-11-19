import * as React from 'react'
import { addToast, dismissToast, subscribe } from './toast'
import { Toast } from './toast'

let mounted = false

export function useToast() {
  const [toasts, setToasts] = React.useState<{ id: string; title?: string; description?: string; action?: React.ReactNode; open: boolean }[]>([])

  React.useEffect(() => {
    if (mounted) return
    mounted = true
    const unsub = subscribe(setToasts)
    return unsub
  }, [])

  const toast = React.useCallback(
    (props: { title?: string; description?: string; action?: React.ReactNode }) => {
      addToast(props)
    },
    [],
  )

  const dismiss = React.useCallback((id: string) => {
    dismissToast(id)
  }, [])

  return { toasts, toast, dismiss }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<{ id: string; title?: string; description?: string; action?: React.ReactNode; open: boolean }[]>([])

  React.useEffect(() => {
    const unsub = subscribe(setToasts)
    return unsub
  }, [])

  const dismiss = React.useCallback((id: string) => {
    dismissToast(id)
  }, [])

  return (
    <>
      {children}
      <div className="top-0 px-4 z-[100] flex flex-col gap-2 pointer-events-none fixed sm:bottom-0 sm:right-0 sm:top-auto sm:max-h-[85vh] w-full sm:w-[420px]">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast
              open={t.open}
              onOpenChange={(open: boolean) => {
                if (!open) dismiss(t.id)
              }}
              description={t.description}
              title={t.title}
              action={t.action}
              onDismiss={() => dismiss(t.id)}
            />
          </div>
        ))}
      </div>
    </>
  )
}

export { addToast, dismissToast, subscribe }
