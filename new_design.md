"use client"
import { LocationSelector } from "@/components/location-selector"
import { SearchBar } from "@/components/search-bar"
import { StreamingResults } from "@/components/streaming-results"
import { ScrollingBanner } from "@/components/scrolling-banner"
import { useStreamingSearch } from "@/hooks/use-streaming-search"
import { Compass } from "lucide-react"

export default function Home() {
  const { content, searchResults, isLoading, search, status, statusMessage } = useStreamingSearch()

  const handleSearch = async (query: string) => {
    search(query)
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b-2 border-black py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Compass className="h-6 w-6" />
            <span className="font-bold text-xl">JUSTLOCAL.AI</span>
          </div>
          <LocationSelector />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-grow isometric-grid pt-16 pb-16">
        <div className="container mx-auto px-4 relative z-10">
          {/* Hero section */}
          <div className="neo-card p-8 mb-8 max-w-4xl mx-auto">
            <h1 className="text-5xl font-black mb-8 tracking-tight text-center">What can I help you to discover?</h1>

            <SearchBar onSearch={handleSearch} />
          </div>

          {/* Streaming Results section */}
          {(content || isLoading || status !== "idle") && (
            <StreamingResults
              content={content}
              searchResults={searchResults}
              isLoading={isLoading}
              status={status}
              statusMessage={statusMessage}
            />
          )}
        </div>
      </main>

      {/* Footer banner */}
      <ScrollingBanner text="FIND HIDDEN GEMS • DISCOVER LOCAL FAVORITES • EXPLORE LIKE A LOCAL • AUTHENTIC RECOMMENDATIONS" />
    </div>
  )
}
