import { Coffee } from 'lucide-react'

export function HeroStrip() {
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning ☕' : hour < 17 ? 'Good afternoon ☕' : 'Good evening ☕'

  return (
    <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#F6EFE3_0%,#FBF7F0_100%)] border border-border p-6 md:p-8">
      {/* Misty mountain illustration on right */}
      <div className="absolute -right-8 -top-8 w-64 h-64 md:w-80 md:h-80 bg-[linear-gradient(135deg,#E8A54B_0%,#14302A_100%)] rounded-full blur-3xl opacity-15 pointer-events-none" />
      <div className="absolute -bottom-12 right-0 w-72 h-48 bg-[linear-gradient(135deg,#14302A_0%,#E8A54B_100%)] rounded-full blur-3xl opacity-10 pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Coffee className="w-5 h-5 text-forest" />
          <h2 className="text-title font-serif text-ink">{greeting}</h2>
        </div>
        <p className="text-body text-rain max-w-md">
          Here’s how your café is doing today. Manage your catalogue, review sales, and track performance below.
        </p>
      </div>
    </section>
  )
}
