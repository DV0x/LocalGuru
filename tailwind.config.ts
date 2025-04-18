// tailwind.config.ts
import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
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
        // Vibrant Explorer Palette
        "future-dark": "#050714",
        "future-dark-800": "#0a0e24",
        "future-dark-700": "#111736",
        "future-dark-600": "#1a2046",
        "future-accent": "#4361EE",
        "future-accent-light": "#4CC9F0",
        "future-accent-dark": "#3A0CA3",
        "future-highlight": "#F72585",
        "future-success": "#4ADE80",
        "future-warning": "#FB923C",
        "future-surface": "rgba(16, 24, 64, 0.7)",
        "future-glass": "rgba(30, 41, 59, 0.6)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "gradient-x": {
          "0%, 100%": {
            "background-position": "0% 50%",
          },
          "50%": {
            "background-position": "100% 50%",
          },
        },
        "gradient-y": {
          "0%, 100%": {
            "background-position": "50% 0%",
          },
          "50%": {
            "background-position": "50% 100%",
          },
        },
        "background-pan": {
          "0%": { backgroundPosition: "0% center" },
          "100%": { backgroundPosition: "200% center" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        float: "float 6s ease-in-out infinite",
        pulse: "pulse 3s ease-in-out infinite",
        "gradient-x": "gradient-x 15s ease infinite",
        "gradient-y": "gradient-y 15s ease infinite",
        "background-pan": "background-pan 3s linear infinite",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "future-grid":
          "linear-gradient(rgba(67, 97, 238, 0.15) 1px, transparent 1px), linear-gradient(to right, rgba(67, 97, 238, 0.15) 1px, transparent 1px)",
        "future-glow": "radial-gradient(circle at center, rgba(67, 97, 238, 0.2) 0%, transparent 70%)",
        "future-card": "linear-gradient(to bottom right, rgba(67, 97, 238, 0.1), rgba(58, 12, 163, 0.1))",
      },
      backgroundSize: {
        "future-grid": "50px 50px",
      },
      boxShadow: {
        "future-glow": "0 0 20px rgba(67, 97, 238, 0.5)",
        "future-card": "0 8px 32px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(67, 97, 238, 0.1)",
        "future-highlight": "0 0 15px rgba(247, 37, 133, 0.5)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config 