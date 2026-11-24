/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Mist & Mug refined brand palette
        forest: "#14302A",      // deep forest green — sidebar, main buttons
        forestSoft: "#2A4639",  // lighter forest for hover states
        wood: "#6E422B",        // warm wood brown
        coffee: "#2A1F17",      // espresso brown — main text
        gold: "#E8A54B",        // amber/honey accent — main actions
        goldSoft: "#F0C98E",    // lighter amber
        goldActive: "#F2B45B",  // warm gold — active sidebar text & icons
        cream: "#F8EBD6",       // warm ivory — sidebar brand title, owner name
        creamSoft: "#E8DDC9",   // soft cream — sidebar navigation text
        creamMuted: "#C9BDA9",  // muted warm beige — sidebar secondary text
        creamIcon: "#D9CCB7",   // soft cream — sidebar inactive navigation icons
        paper: "#F6EFE3",       // warm cream background
        paperSoft: "#FBF7F0",   // slightly lighter cream for cards
        rain: "#7A6A5A",        // warm taupe — muted text
        sage: "#8FAE9E",        // soft sage green — Available
        terracotta: "#C27A5E",  // muted terracotta — Unavailable/Deactivated
        ink: "#2A1F17",         // espresso brown text
        border: "rgba(210, 196, 174, 0.35)",   // soft warm beige borders
        borderSoft: "rgba(210, 196, 174, 0.18)", // fainter borders
        "border-line": "rgba(36,26,18,0.16)",
        shadow: "rgba(26, 22, 16, 0.08)",      // warm layered shadow
        // Tailwind UI color map (for shadcn-style components)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "16px",
        md: "10px",
        sm: "6px",
        full: "9999px",
      },
      fontFamily: {
        serif: ["var(--font-serif)"],
        sans: ["var(--font-sans)"],
        hand: ["var(--font-hand)"],
      },
      fontSize: {
        // Page title
        "title": ["34px", { lineHeight: "1.2", fontWeight: "600", letterSpacing: "-0.02em" }],
        // Section titles
        "section": ["21px", { lineHeight: "1.3", fontWeight: "600", letterSpacing: "-0.01em" }],
        // Card titles
        "card-title": ["16px", { lineHeight: "1.4", fontWeight: "600" }],
        // Body
        "body": ["14px", { lineHeight: "1.6" }],
        // Labels
        "label": ["12px", { lineHeight: "1.5", fontWeight: "500", letterSpacing: "0.08em" }],
        // Tabular numbers
        "number": ["20px", { lineHeight: "1.2", fontVariantNumeric: "tabular-nums" }],
        "number-sm": ["16px", { lineHeight: "1.4", fontVariantNumeric: "tabular-nums" }],
        "number-xs": ["13px", { lineHeight: "1.5", fontVariantNumeric: "tabular-nums" }],
      },
      spacing: {
        // 8px grid
        "4.5": "18px",
        "12.5": "50px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "press-down": {
          "0%": { transform: "scale(1)" },
          "100%": { transform: "scale(0.97)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s ease-out forwards",
        "slide-in-right": "slide-in-right 0.3s ease-out forwards",
        "shimmer": "shimmer 2s infinite",
        "press-down": "press-down 0.1s ease-in forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
