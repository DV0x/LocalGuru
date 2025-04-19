### Step 1: Install Required Dependencies

Ensure you have all necessary dependencies:

```shellscript
# Install Lucide React for icons
npm install lucide-react

# If you're not already using Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Step 2: Set Up Tailwind Configuration

Create or update your `tailwind.config.ts` file:
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

### Step 3: Create or Update CSS Variables

Create a new file or update your existing global CSS file:

/* globals.css or your main CSS file */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 255 255 255;
  --foreground: 0 0 0;
  --card: 255 255 255;
  --card-foreground: 0 0 0;
  --popover: 255 255 255;
  --popover-foreground: 0 0 0;

  /* Vibrant Explorer Palette */
  --primary: 111 30 214; /* Electric purple */
  --primary-foreground: 255 255 255;
  --secondary: 255 214 0; /* Bright yellow */
  --secondary-foreground: 0 0 0;
  --muted: 240 240 240;
  --muted-foreground: 120 120 120;
  --accent: 0 222 163; /* Mint green */
  --accent-foreground: 0 0 0;
  --destructive: 255 50 50;
  --destructive-foreground: 255 255 255;
  --border: 240 240 240;
  --input: 240 240 240;
  --ring: 111 30 214; /* Electric purple */
  --radius: 0.5rem;

  /* Custom colors for our Y2K/neo-brutalist theme */
  --grid-primary: 111 30 214; /* Electric purple */
  --grid-secondary: 72 12 168; /* Deep purple */
  --cta: 255 214 0; /* Bright yellow */
  --cta-shadow: 255 165 0; /* Orange */
  --badge-yellow: 255 214 0; /* Bright yellow */
  --badge-text: 0 0 0; /* Black */

  /* Category colors */
  --cat-restaurant: 255 64 129; /* Hot pink */
  --cat-outdoors: 0 222 163; /* Mint green */
  --cat-entertainment: 255 109 0; /* Bright orange */
  --cat-shopping: 0 176 255; /* Bright blue */
  --cat-cafe: 255 214 0; /* Bright yellow */
  --cat-bar: 255 64 129; /* Hot pink */
  --cat-hidden-gem: 111 30 214; /* Electric purple */
  --cat-food: 255 64 129; /* Hot pink */
}

.dark {
  --background: 20 20 20;
  --foreground: 255 255 255;
  --card: 40 40 40;
  --card-foreground: 255 255 255;
  --popover: 40 40 40;
  --popover-foreground: 255 255 255;
  --primary: 111 30 214;
  --primary-foreground: 255 255 255;
  --secondary: 255 214 0;
  --secondary-foreground: 0 0 0;
  --muted: 40 40 40;
  --muted-foreground: 180 180 180;
  --accent: 0 222 163;
  --accent-foreground: 0 0 0;
  --destructive: 255 50 50;
  --destructive-foreground: 255 255 255;
  --border: 60 60 60;
  --input: 60 60 60;
  --ring: 111 30 214;
}

@layer components {
  /* Isometric grid background */
  .isometric-grid {
    background-color: rgb(var(--grid-primary));
    background-image: linear-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.15) 1px, transparent 1px),
      linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
    background-size: 100px 100px, 100px 100px, 20px 20px, 20px 20px;
    background-position: -1px -1px, -1px -1px, -1px -1px, -1px -1px;
    background-attachment: fixed;
    perspective: 1000px;
    transform-style: preserve-3d;
  }

  .isometric-grid::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(var(--grid-primary), 1) 0%, rgba(var(--grid-secondary), 1) 100%);
    opacity: 0.85;
    z-index: -1;
  }

  /* Neo-brutalist card */
  .neo-card {
    @apply bg-white border-2 border-black relative overflow-hidden;
    box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 1);
  }

  /* Offset button with shadow */
  .offset-btn {
    @apply relative inline-flex items-center justify-center font-bold text-black px-6 py-3 border-2 border-black transition-transform duration-200;
    background-color: rgb(var(--cta));
    box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 1);
    transform: translate(-2px, -2px);
  }

  .offset-btn:hover {
    transform: translate(0, 0);
    box-shadow: 0px 0px 0 0 rgba(0, 0, 0, 1);
  }

  .offset-btn:active {
    @apply bg-opacity-90;
  }

  /* Starburst badge */
  .starburst {
    @apply flex items-center justify-center font-bold text-center;
    background-color: rgb(var(--badge-yellow));
    color: rgb(var(--badge-text));
    width: 80px;
    height: 80px;
    position: relative;
    text-align: center;
    transform: rotate(15deg);
  }

  .starburst::before,
  .starburst::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: inherit;
    z-index: -1;
  }

  .starburst::before {
    transform: rotate(30deg);
  }

  .starburst::after {
    transform: rotate(60deg);
  }

  /* Location pill */
  .location-pill {
    @apply bg-white text-black px-4 py-2 rounded-full border-2 border-black inline-flex items-center gap-2 font-medium;
    box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 1);
  }

  /* Search input */
  .search-input {
    @apply w-full bg-white border-2 border-black px-4 py-3 text-lg focus:outline-none;
    box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 1);
  }

  /* Result card */
  .result-card {
    @apply bg-white border-2 border-black p-4 relative;
    box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 1);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .result-card:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 0 rgba(0, 0, 0, 1);
  }

  /* Category tag */
  .category-tag {
    @apply inline-flex items-center justify-center px-3 py-1 text-sm font-medium border border-black;
  }

  /* Scrolling banner */
  .scrolling-banner {
    @apply bg-black text-white py-2 whitespace-nowrap overflow-hidden;
  }

  .scrolling-text {
    display: inline-block;
    animation: scroll 20s linear infinite;
  }

  @keyframes scroll {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(-50%);
    }
  }
}

### Step 4: Create Component Directory Structure

Create directories for your new components:
# Create component directories if they don't exist
mkdir -p src/components
mkdir -p src/hooks
mkdir -p src/lib/search

### Step 5: Implement the Types

Create the streaming types file:

// src/lib/search/streaming-types.ts
export type StreamingStatus =
  | "idle"
  | "initializing"
  | "searching"
  | "search_complete"
  | "generating"
  | "complete"
  | "error"

### Step 6: Implement the Location Selector Component

Create the location selector component:

// src/components/location-selector.tsx
"use client"

import { useState } from "react"
import { MapPin, ChevronDown } from 'lucide-react'

interface LocationSelectorProps {
  initialLocation?: string
  onLocationChange?: (location: string) => void
}

export function LocationSelector({ 
  initialLocation = "San Francisco, CA", 
  onLocationChange 
}: LocationSelectorProps) {
  const [location, setLocation] = useState(initialLocation)
  const [isOpen, setIsOpen] = useState(false)

  // You can customize this list based on your application needs
  const locations = ["San Francisco, CA", "New York, NY", "Los Angeles, CA", "Chicago, IL", "Seattle, WA"]

  const handleLocationChange = (loc: string) => {
    setLocation(loc)
    setIsOpen(false)
    if (onLocationChange) {
      onLocationChange(loc)
    }
  }

  return (
    <div className="relative">
      <button
        className="location-pill"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <MapPin size={18} />
        <span>{location}</span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute mt-2 w-full z-10">
          <ul className="neo-card py-1 max-h-60 overflow-auto" role="listbox" aria-label="Select a location">
            {locations.map((loc) => (
              <li
                key={loc}
                className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${location === loc ? "font-bold" : ""}`}
                onClick={() => handleLocationChange(loc)}
                role="option"
                aria-selected={location === loc}
              >
                {loc}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

### Step 7: Implement the Search Bar Component

Create the search bar component:

// src/components/search-bar.tsx
"use client"

import { useState, type FormEvent } from "react"
import { Search, Mic } from 'lucide-react'

interface SearchBarProps {
  onSearch: (query: string) => void
  placeholder?: string
  initialQuery?: string
}

export function SearchBar({ 
  onSearch, 
  placeholder = "Discover hidden restaurants, activities, local spots...",
  initialQuery = ""
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      onSearch(query)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
      <div className="relative">
        <input
          type="text"
          className="search-input pr-24"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search query"
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <button 
            type="button" 
            className="p-2 hover:bg-gray-100 rounded-full" 
            aria-label="Voice search"
            onClick={() => {
              // Implement voice search functionality if needed
              console.log("Voice search clicked")
            }}
          >
            <Mic size={20} />
          </button>

          <button type="submit" className="offset-btn !py-1 !px-4" disabled={!query.trim()}>
            <Search size={20} className="mr-1" />
            <span>Search</span>
          </button>
        </div>
      </div>
    </form>
  )
}

### Step 8: Implement the Result Card Component

Create the result card component:

// src/components/result-card.tsx
"use client"

import { MapPin, ExternalLink, ThumbsUp, ThumbsDown } from 'lucide-react'

export interface LocalResult {
  id: string
  title: string
  location: string
  description: string
  categories: string[]
  source?: string
  sourceUrl?: string
  rating?: number
}

interface ResultCardProps {
  result: LocalResult
  onFeedback?: (id: string, isPositive: boolean) => void
}

export function ResultCard({ result, onFeedback }: ResultCardProps) {
  const { id, title, location, description, categories, source, sourceUrl, rating } = result

  // Determine category colors using our new vibrant palette
  const getCategoryColor = (category: string) => {
    const categoryMap: Record<string, string> = {
      Restaurant: "bg-[rgb(var(--cat-restaurant))]",
      Bar: "bg-[rgb(var(--cat-bar))]",
      Cafe: "bg-[rgb(var(--cat-cafe))]",
      Outdoors: "bg-[rgb(var(--cat-outdoors))]",
      Shopping: "bg-[rgb(var(--cat-shopping))]",
      Entertainment: "bg-[rgb(var(--cat-entertainment))]",
      "Hidden Gem": "bg-[rgb(var(--cat-hidden-gem))]",
      Food: "bg-[rgb(var(--cat-food))]",
    }

    return categoryMap[category] || "bg-gray-200"
  }

  // Determine text color based on background color
  const getTextColor = (category: string) => {
    const darkTextCategories = ["Cafe", "Outdoors"]
    return darkTextCategories.includes(category) ? "text-black" : "text-white"
  }

  return (
    <div className="result-card">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-xl font-bold">{title}</h3>

        {rating && (
          <div className="starburst text-xs">
            <div className="rotate-[-15deg]">
              {Math.round(rating * 100)}%<br />
              MATCH
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center text-sm mb-3">
        <MapPin size={16} className="mr-1" />
        <span>{location}</span>
      </div>

      <p className="mb-4">{description}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map((category) => (
          <span key={category} className={`category-tag ${getCategoryColor(category)} ${getTextColor(category)}`}>
            {category}
          </span>
        ))}
      </div>

      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
        <div className="text-sm">
          {source && (
            <div className="flex items-center">
              <span>Source: {source}</span>
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 inline-flex items-center hover:underline"
                >
                  <ExternalLink size={14} />
                  <span className="sr-only">Open source link</span>
                </a>
              )}
            </div>
          )}
        </div>

        {onFeedback && (
          <div className="flex items-center gap-2">
            <button 
              className="p-1 hover:bg-gray-100" 
              onClick={() => onFeedback(id, true)} 
              aria-label="Helpful"
            >
              <ThumbsUp size={18} />
            </button>
            <button 
              className="p-1 hover:bg-gray-100" 
              onClick={() => onFeedback(id, false)} 
              aria-label="Not helpful"
            >
              <ThumbsDown size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export const TravelRecommendation = ResultCard

### Step 9: Implement the Scrolling Banner Component

Create the scrolling banner component:

// src/components/scrolling-banner.tsx
export function ScrollingBanner({ text }: { text: string }) {
  // Duplicate the text to create a seamless loop
  const repeatedText = `${text} • ${text}`

  return (
    <div className="scrolling-banner">
      <div className="scrolling-text">{repeatedText}</div>
    </div>
  )
}

### Step 10: Implement the Streaming Results Component

Create the streaming results component:

// src/components/streaming-results.tsx
"use client"
import { Check, AlertTriangle, Sparkles } from 'lucide-react'
import type { StreamingStatus } from "@/lib/search/streaming-types"
import ReactMarkdown from "react-markdown"

interface SearchResult {
  id: string
  title: string
  snippet: string
  url?: string
  subreddit?: string
  author?: string
  created_at?: string
  index: number
}

interface StreamingResultsProps {
  content: string
  searchResults: SearchResult[]
  isLoading: boolean
  status: StreamingStatus
  statusMessage: string
}

export function StreamingResults({ 
  content, 
  searchResults, 
  isLoading, 
  status, 
  statusMessage 
}: StreamingResultsProps) {
  // Render status indicators based on current status
  const renderStatusIndicator = () => {
    if (status === "initializing" || status === "searching") {
      return (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="inline-block h-12 w-12 border-4 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-bold">{statusMessage || "Searching for local gems..."}</p>
        </div>
      )
    }

    if (status === "search_complete") {
      return (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-[rgb(var(--accent))] mb-4">
            <Check className="h-8 w-8 text-white" />
          </div>
          <p className="font-bold">{statusMessage || `Found ${searchResults.length} results`}</p>
          <p className="text-gray-600 text-sm mt-2">Generating insights...</p>
        </div>
      )
    }

    if (status === "generating") {
      return (
        <div className="flex flex-col items-center justify-center py-4 mb-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[rgb(var(--primary))] mb-3">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <p className="font-bold text-[rgb(var(--primary))]">AI is synthesizing insights...</p>
          <div className="flex space-x-2 mt-3">
            <div className="w-2 h-2 bg-[rgb(var(--primary))] rounded-full animate-pulse delay-100"></div>
            <div className="w-2 h-2 bg-[rgb(var(--accent))] rounded-full animate-pulse delay-300"></div>
            <div className="w-2 h-2 bg-[rgb(var(--secondary))] rounded-full animate-pulse delay-500"></div>
          </div>
        </div>
      )
    }

    if (status === "error") {
      return (
        <div className="flex flex-col items-center justify-center py-10 bg-red-50 rounded-lg">
          <AlertTriangle className="h-12 w-12 mb-2 text-red-500" />
          <p className="font-bold text-red-500">{statusMessage || "Something went wrong"}</p>
        </div>
      )
    }

    return null
  }

  return (
    <div className="w-full mt-8 max-w-3xl mx-auto mb-8">
      <div className="neo-card p-6">
        {content ? (
          <>
            {status === "generating" && <div className="border-b border-gray-200 mb-6">{renderStatusIndicator()}</div>}
            <div className="prose prose-lg max-w-none">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          </>
        ) : (
          <div>{renderStatusIndicator()}</div>
        )}
      </div>
    </div>
  )
}

### Step 11: Implement the Main Page

Create or update your main page component:

