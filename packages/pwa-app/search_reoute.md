
# Step-by-Step Implementation Plan with Code

## 1. Create Folder Structure

```
packages/pwa-app/
├── app/
│   ├── search/
│   │   ├── [query]/
│   │   │   └── page.tsx
│   ├── components/
│   │   ├── search/
│   │   │   ├── bottom-sheet.tsx
│   │   │   ├── map-placeholder.tsx
│   │   │   ├── search-header.tsx
│   │   │   └── streaming-content.tsx
│   ├── contexts/
│   │   └── search-context.tsx
│   ├── hooks/
│   │   └── use-bottom-sheet.ts
│   ├── lib/
│   │   ├── animations/
│   │   │   ├── page-transitions.ts
│   │   │   └── sheet-animations.ts
│   │   └── utils/
│   │       └── url-helpers.ts
```

## 2. Create Search Context

```tsx
// contexts/search-context.tsx
"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { useStreamingSearch } from "@/app/hooks/use-streaming-search";
import { SearchStatus } from "@/app/lib/types/search";

interface SearchContextType {
  query: string;
  status: SearchStatus;
  content: string;
  error: string | null;
  isLoading: boolean;
  search: (query: string, location?: string) => Promise<void>;
  stopSearch: () => void;
  setCurrentQuery: (query: string) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [currentQuery, setCurrentQuery] = useState("");
  const { status, content, error, search, stopSearch, isLoading } = useStreamingSearch();

  // Wrap the search function to update current query
  const handleSearch = async (query: string, location?: string) => {
    setCurrentQuery(query);
    await search(query, location);
  };

  return (
    <SearchContext.Provider
      value={{
        query: currentQuery,
        status,
        content,
        error,
        isLoading,
        search: handleSearch,
        stopSearch,
        setCurrentQuery
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error("useSearch must be used within a SearchProvider");
  }
  return context;
}
```

## 3. Create Bottom Sheet Hook

```tsx
// hooks/use-bottom-sheet.ts
"use client";

import { useState, useRef } from "react";
import { MotionValue, useMotionValue, useTransform, useSpring, useAnimationControls } from "framer-motion";

export type SheetState = "peek" | "half" | "full";

interface UseBottomSheetProps {
  initialState?: SheetState;
}

interface SheetDimensions {
  peek: number;
  half: number;
  full: number;
}

export function useBottomSheet({ initialState = "peek" }: UseBottomSheetProps = {}) {
  const [sheetState, setSheetState] = useState<SheetState>(initialState);
  const dimensions = useRef<SheetDimensions>({
    peek: 150, // Just title and a bit more
    half: window.innerHeight * 0.5,
    full: window.innerHeight * 0.9,
  });
  
  // Animation controls for programmatic animations
  const controls = useAnimationControls();
  
  // Motion values for drag
  const y = useMotionValue(dimensions.current[initialState]);
  const springY = useSpring(y, { damping: 20, stiffness: 200 });
  
  // Transform y to opacity for background overlay
  const sheetOpacity = useTransform(
    y,
    [dimensions.current.full, dimensions.current.peek],
    [0.6, 0.2]
  );
  
  // Snap to positions
  const snapToPosition = (state: SheetState) => {
    const position = dimensions.current[state];
    setSheetState(state);
    controls.start({ y: position });
  };
  
  // Handle drag end - snap to closest position
  const handleDragEnd = (_: any, info: any) => {
    const velocity = info.velocity.y;
    const currentY = y.get();
    
    // Fast drag down = peek, fast drag up = full
    if (velocity > 500) {
      snapToPosition("peek");
      return;
    }
    
    if (velocity < -500) {
      snapToPosition("full");
      return;
    }
    
    // Otherwise, find closest position
    const positions = [
      { state: "peek", y: dimensions.current.peek },
      { state: "half", y: dimensions.current.half },
      { state: "full", y: dimensions.current.full },
    ];
    
    const closest = positions.reduce((prev, curr) => {
      return Math.abs(curr.y - currentY) < Math.abs(prev.y - currentY) ? curr : prev;
    });
    
    snapToPosition(closest.state as SheetState);
  };
  
  return {
    sheetState,
    springY,
    sheetOpacity,
    controls,
    snapToPosition,
    handleDragEnd,
    dimensions: dimensions.current,
  };
}
```

## 4. Create Bottom Sheet Component

```tsx
// components/search/bottom-sheet.tsx
"use client";

import { motion } from "framer-motion";
import { useBottomSheet, SheetState } from "@/app/hooks/use-bottom-sheet";
import { useSearch } from "@/app/contexts/search-context";
import { StreamingContent } from "./streaming-content";

interface BottomSheetProps {
  title: string;
  subtitle?: string;
}

export function BottomSheet({ title, subtitle }: BottomSheetProps) {
  const { sheetState, springY, sheetOpacity, handleDragEnd, snapToPosition } = useBottomSheet();
  const { content, status, error } = useSearch();
  
  // Handle sheet expand toggle on title bar click
  const handleTitleClick = () => {
    if (sheetState === "peek") {
      snapToPosition("half");
    } else {
      snapToPosition("peek");
    }
  };
  
  return (
    <>
      {/* Darkening overlay */}
      <motion.div 
        className="fixed inset-0 bg-black pointer-events-none z-10"
        style={{ opacity: sheetOpacity }}
      />
      
      {/* Bottom sheet */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-xl z-20 overflow-hidden"
        style={{ y: springY }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        dragMomentum={false}
        initial={{ y: window.innerHeight }}
        animate={{ y: springY }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
      >
        {/* Handle bar */}
        <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3" />
        
        {/* Title bar - clickable to expand/collapse */}
        <div 
          className="p-4 cursor-pointer"
          onClick={handleTitleClick}
        >
          <h2 className="text-2xl font-bold">{title}</h2>
          {subtitle && <p className="text-gray-600">{subtitle}</p>}
        </div>
        
        {/* Divider */}
        <div className="h-px bg-gray-200 w-full" />
        
        {/* Content area */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>
          <StreamingContent content={content} status={status} error={error} />
        </div>
        
        {/* Action buttons */}
        <div className="p-4 flex space-x-4 border-t border-gray-200">
          <button className="flex-1 py-3 flex justify-center items-center border rounded-full">
            <span className="icon-save mr-2" />
            <span>Save</span>
          </button>
          <button className="flex-1 py-3 flex justify-center items-center bg-black text-white rounded-full">
            <span className="icon-navigate mr-2" />
            <span>Navigate</span>
          </button>
          <button className="flex-1 py-3 flex justify-center items-center border rounded-full">
            <span className="icon-share mr-2" />
            <span>Share</span>
          </button>
        </div>
      </motion.div>
    </>
  );
}
```

## 5. Create Streaming Content Component

```tsx
// components/search/streaming-content.tsx
"use client";

import { SearchStatus } from "@/app/lib/types/search";
import { motion, AnimatePresence } from "framer-motion";

interface StreamingContentProps {
  content: string;
  status: SearchStatus;
  error: string | null;
}

export function StreamingContent({ content, status, error }: StreamingContentProps) {
  const isContentValid = content && !content.includes("METADATA:") && content.trim() !== "";
  
  // Loading indicator based on status
  const renderStatusIndicator = () => {
    switch (status) {
      case "searching":
        return (
          <div className="flex items-center justify-center p-6">
            <div className="animate-pulse text-center">
              <div className="inline-block h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="mt-4 text-sm text-muted-foreground">Searching for insights...</p>
            </div>
          </div>
        );
      case "streaming":
        return (
          <div className="flex items-center justify-center p-6">
            <div className="animate-pulse text-center">
              <div className="inline-block h-6 w-6 border-4 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="mt-4 text-sm text-muted-foreground">Generating insights...</p>
            </div>
          </div>
        );
      case "error":
        return (
          <div className="rounded-lg bg-destructive/20 p-4 text-center text-destructive">
            <p>{error || "An error occurred. Please try again."}</p>
          </div>
        );
      default:
        return null;
    }
  };
  
  // Render content paragraphs with animation
  const renderContent = () => {
    if (!isContentValid) return null;
    
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="prose prose-sm max-w-none"
      >
        {content.split("\n").map((paragraph, i) => (
          paragraph.trim() ? (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              {paragraph}
            </motion.p>
          ) : <br key={i} />
        ))}
      </motion.div>
    );
  };
  
  return (
    <AnimatePresence mode="wait">
      {status === "searching" || status === "streaming" ? (
        renderStatusIndicator()
      ) : (
        renderContent()
      )}
    </AnimatePresence>
  );
}
```

## 6. Create Map Placeholder Component

```tsx
// components/search/map-placeholder.tsx
"use client";

import { motion } from "framer-motion";

interface MapPlaceholderProps {
  query: string;
}

export function MapPlaceholder({ query }: MapPlaceholderProps) {
  // In a real implementation, this would use Mapbox
  // For now, we'll create a simple placeholder
  
  return (
    <div className="w-full h-full bg-gray-100 relative">
      {/* Fake map grid */}
      <div 
        className="absolute inset-0"
        style={{ 
          backgroundImage: "linear-gradient(rgba(200, 200, 200, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(200, 200, 200, 0.2) 1px, transparent 1px)",
          backgroundSize: "50px 50px" 
        }}
      />
      
      {/* Fake neighborhood labels */}
      <div className="absolute top-1/4 left-1/4 text-gray-400 font-light">MISSION<br/>DISTRICT</div>
      <div className="absolute bottom-1/4 left-1/5 text-gray-400 font-light">NOE<br/>VALLEY</div>
      <div className="absolute top-1/3 right-1/4 text-gray-400 font-light">POTRERO<br/>HILL</div>
      
      {/* Animated pin */}
      <motion.div 
        className="absolute"
        style={{ top: "calc(50% - 15px)", left: "calc(50% - 15px)" }}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ 
          type: "spring",
          delay: 0.3,
          duration: 0.6
        }}
      >
        <div className="w-9 h-9 bg-yellow-400 rounded-full flex items-center justify-center relative">
          <div className="w-3 h-3 bg-black rounded-full" />
          <div 
            className="absolute bottom-0 left-1/2 w-5 h-5 bg-yellow-400"
            style={{ 
              transform: "translateX(-50%) rotate(45deg)",
              clipPath: "polygon(0 0, 100% 100%, 0 100%)"
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}
```

## 7. Create Search Header Component

```tsx
// components/search/search-header.tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useSearch } from "@/app/contexts/search-context";

interface SearchHeaderProps {
  initialQuery?: string;
}

export function SearchHeader({ initialQuery = "" }: SearchHeaderProps) {
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();
  const { search, isLoading } = useSearch();
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    
    // Update URL without triggering navigation
    const encodedQuery = encodeURIComponent(query);
    router.replace(`/search/${encodedQuery}`);
    
    // Start search
    search(query);
  };
  
  return (
    <motion.div 
      className="absolute top-0 left-0 right-0 p-4 z-30"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.1, duration: 0.3 }}
    >
      <form onSubmit={handleSearch}>
        <div className="relative bg-white rounded-full shadow-md flex items-center overflow-hidden">
          <span className="pl-4 text-gray-400">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 21L15.5 15.5M15.5 15.5C17.0913 13.9087 18 11.7558 18 9.5C18 5 14.5 1.5 10 1.5C5.5 1.5 2 5 2 9.5C2 14 5.5 17.5 10 17.5C12.2558 17.5 14.4087 16.5913 16 15M15.5 15.5L16 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <input
            type="text"
            className="w-full py-3 px-2 outline-none text-gray-800"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isLoading}
          />
          {isLoading && (
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-4" />
          )}
        </div>
      </form>
    </motion.div>
  );
}
```

## 8. Create Search Results Page

```tsx
// app/search/[query]/page.tsx
"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import { SearchHeader } from "@/app/components/search/search-header";
import { MapPlaceholder } from "@/app/components/search/map-placeholder";
import { BottomSheet } from "@/app/components/search/bottom-sheet";
import { useSearch } from "@/app/contexts/search-context";

export default function SearchResultsPage() {
  const params = useParams();
  const query = typeof params.query === "string" ? decodeURIComponent(params.query) : "";
  const { search, setCurrentQuery } = useSearch();
  
  // Start search when page loads
  useEffect(() => {
    if (query) {
      setCurrentQuery(query);
      search(query);
    }
  }, [query, search, setCurrentQuery]);
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="w-screen h-screen overflow-hidden relative"
    >
      {/* Map background */}
      <div className="w-full h-full">
        <MapPlaceholder query={query} />
      </div>
      
      {/* Search header */}
      <SearchHeader initialQuery={query} />
      
      {/* Bottom sheet with content */}
      <BottomSheet 
        title={query || "Search Results"}
        subtitle="Indian vegetarian restaurant" // This would be dynamic in real implementation
      />
    </motion.div>
  );
}
```

## 9. Update Root Layout with Provider

```tsx
// app/layout.tsx
import { SearchProvider } from "@/app/contexts/search-context";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SearchProvider>
          {children}
        </SearchProvider>
      </body>
    </html>
  );
}
```

## 10. Update Home Page for Navigation

```tsx
// app/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { SearchBar } from "@/app/components/search-bar";
import { useState } from "react";
import { useSearch } from "@/app/contexts/search-context";

export default function PwaHomePage() {
  const [location, setLocation] = useState("San Francisco");
  const router = useRouter();
  const { setCurrentQuery } = useSearch();
  
  const handleSearch = (query: string) => {
    if (!query.trim()) return;
    
    // Set the query in context and navigate to search page
    setCurrentQuery(query);
    router.push(`/search/${encodeURIComponent(query)}`);
  };
  
  const handleLocationChange = (newLocation: string) => {
    console.log("Location changed:", newLocation);
    setLocation(newLocation);
  };

  return (
    <motion.div 
      className="w-full h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <main className="isometric-grid flex flex-col items-center min-h-screen overflow-auto">
        {/* Animated grid overlay */}
        <motion.div 
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(67, 97, 238, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(67, 97, 238, 0.1) 1px, transparent 1px)",
            backgroundSize: "50px 50px"
          }}
          animate={{
            backgroundPosition: ["0px 0px", "50px 50px"],
          }}
          transition={{
            duration: 20,
            ease: "linear",
            repeat: Infinity,
          }}
        />
        
        {/* Animated glow */}
        <motion.div
          className="absolute inset-0 z-0 opacity-30 pointer-events-none"
          style={{
            background: "radial-gradient(circle at center, rgba(67, 97, 238, 0.2) 0%, transparent 70%)"
          }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.2, 0.3, 0.2],
          }}
          transition={{
            duration: 8,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
        
        {/* Content container with higher z-index */}
        <div className="relative z-20 w-full px-6 max-w-lg mx-auto flex flex-col items-center pt-12 pb-32">
          {/* Logo/Text */}
          <motion.h1 
            className="text-5xl font-bold text-white glow-text mb-8 relative z-20"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ 
              delay: 0.5,
              duration: 0.8,
              ease: "easeOut"
            }}
          >
            justlocal.ai
          </motion.h1>
          
          {/* Search Bar */}
          <motion.div
            className="w-full relative z-20"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ 
              delay: 0.7,
              duration: 0.8,
              ease: "easeOut"
            }}
          >
            <SearchBar
              onSearch={handleSearch}
              initialLocation={location}
              onLocationChange={handleLocationChange}
            />
          </motion.div>
        </div>
      </main>
    </motion.div>
  );
}
```

## 11. Add Page Transitions

```tsx
// app/page-transitions.tsx
"use client";

import { ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

export function PageTransitions({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  return (
    <AnimatePresence mode="wait" initial={false}>
      <div key={pathname}>{children}</div>
    </AnimatePresence>
  );
}
```

Then update the root layout:

```tsx
// app/layout.tsx
import { SearchProvider } from "@/app/contexts/search-context";
import { PageTransitions } from "./page-transitions";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SearchProvider>
          <PageTransitions>
            {children}
          </PageTransitions>
        </SearchProvider>
      </body>
    </html>
  );
}
```

## 12. Implementation Timeline

1. **Week 1: Core Structure**
   - Set up folder structure
   - Create search context
   - Implement basic routing
   
2. **Week 1-2: Main Components**
   - Create bottom sheet component with animations
   - Implement map placeholder
   - Build search header

3. **Week 2: Integration**
   - Connect streaming search to new components
   - Implement page transitions
   - Fine-tune animations

4. **Week 3: Polish**
   - Add loading states
   - Improve touch interactions
   - Fix edge cases and bugs
   - Optimize performance

5. **Week 3-4: Testing & Refinement**
   - Test on various device sizes
   - Refine animations and transitions
   - Implement any feedback
   - Documentation

This implementation plan provides a structured approach with a clean architecture that separates concerns and maintains the streaming functionality while adding the new UI layout and navigation flow you requested.
