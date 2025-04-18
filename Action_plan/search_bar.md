"use client"

import { useState, type FormEvent } from "react"
import { Search, Mic } from "lucide-react"

interface SearchBarProps {
  onSearch: (query: string) => void
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState("")

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
          placeholder="Discover hidden restaurants, activities, local spots..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search query"
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <button type="button" className="p-2 hover:bg-gray-100 rounded-full" aria-label="Voice search">
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
