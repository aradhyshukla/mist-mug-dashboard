/**
 * Mist & Mug — Cross-page data change events
 *
 * Allows pages to react when IndexedDB data changes (e.g., after upload
 * deletion or import). Pages listen for the event and re-fetch data.
 */

export const DATA_CHANGED_EVENT = 'mistmug:data-changed'

export function emitDataChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT))
  }
}

export function onDataChanged(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(DATA_CHANGED_EVENT, callback)
  return () => window.removeEventListener(DATA_CHANGED_EVENT, callback)
}
