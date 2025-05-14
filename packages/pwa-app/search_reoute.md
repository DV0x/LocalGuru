
# Detailed Implementation Plan for Search Results Page

## 1. Set Up Route Structure (1-2 hours)

1. **Create new route file structure:**
   ```
   app/
     page.tsx (home page)
     search/
       [query]/
         page.tsx (results page)
         layout.tsx (optional - for shared layout)
   ```

2. **Implement dynamic route params:**
   - Create the dynamic route in Next.js for `/search/[query]`
   - Set up proper URL encoding/decoding for search queries
   - Add metadata generation for SEO

## 2. Refactor State Management (2-3 hours)

1. **Create a shared search context:**
   ```typescript
   // app/contexts/search-context.tsx
   export const SearchContext = createContext<{
     query: string;
     status: SearchStatus;
     content: string;
     error: string | null;
     search: (query: string, location?: string) => void;
     stopSearch: () => void;
     isLoading: boolean;
   }>({...});

   export function SearchProvider({ children }: { children: React.ReactNode }) {
     // Move logic from useStreamingSearch here
     // ...
     return <SearchContext.Provider value={...}>{children}</SearchContext.Provider>
   }
   ```

2. **Create a custom hook for the context:**
   ```typescript
   // app/hooks/use-search-context.ts
   export function useSearchContext() {
     const context = useContext(SearchContext);
     if (!context) throw new Error("useSearchContext must be used within a SearchProvider");
     return context;
   }
   ```

3. **Update layout to include provider:**
   ```typescript
   // app/layout.tsx
   export default function RootLayout({ children }) {
     return (
       <html>
         <body>
           <SearchProvider>{children}</SearchProvider>
         </body>
       </html>
     );
   }
   ```

## 3. Create Draggable Content Overlay Component (3-4 hours)

1. **Create base component:**
   ```typescript
   // app/components/draggable-content-overlay.tsx
   export function DraggableContentOverlay({
     content,
     status,
     error
   }: {
     content: string;
     status: SearchStatus;
     error: string | null;
   }) {
     // Implementation here
   }
   ```

2. **Add draggable functionality with Framer Motion:**
   - Set up drag constraints
   - Create snap points (bottom, middle, top)
   - Add spring animations

3. **Implement content rendering:**
   - Loading states
   - Error handling
   - Content formatting with proper styling
   - Auto-scroll for streaming content

## 4. Create Map Background Placeholder (1-2 hours)

1. **Create map placeholder component:**
   ```typescript
   // app/components/map-placeholder.tsx
   export function MapPlaceholder() {
     // Simple grid background as placeholder for Mapbox
     return (
       <div className="absolute inset-0 z-0 bg-gray-100">
         {/* Placeholder grid pattern */}
       </div>
     );
   }
   ```

2. **Add simple map controls:**
   - Zoom placeholder buttons
   - Layer toggle placeholders
   - Position correctly with z-index

## 5. Create Persistent Search Header (2-3 hours)

1. **Create search header component:**
   ```typescript
   // app/components/search-header.tsx
   export function SearchHeader({
     initialQuery,
     onSearch,
     isLoading
   }: {
     initialQuery: string;
     onSearch: (query: string) => void;
     isLoading: boolean;
   }) {
     // Implementation here
   }
   ```

2. **Style for persistent header:**
   - Sticky positioning
   - Compact design
   - Loading indicator integration
   - Back button to home

## 6. Implement Home Page Navigation (1-2 hours)

1. **Update home page for navigation:**
   ```typescript
   // app/page.tsx
   export default function HomePage() {
     const router = useRouter();
     
     const handleSearch = (query: string) => {
       // Navigate to search page instead of in-page results
       router.push(`/search/${encodeURIComponent(query)}`);
     };
     
     // Rest of component
   }
   ```

2. **Add smooth page exit animations:**
   - Use Framer Motion's AnimatePresence
   - Coordinate animations with page transitions

## 7. Implement Search Results Page (3-4 hours)

1. **Create search results page:**
   ```typescript
   // app/search/[query]/page.tsx
   export default function SearchResultsPage({
     params
   }: {
     params: { query: string }
   }) {
     const { query } = params;
     const decodedQuery = decodeURIComponent(query);
     const { search, status, content, error, isLoading } = useSearchContext();
     
     // Initiate search when page loads or query changes
     useEffect(() => {
       search(decodedQuery);
     }, [decodedQuery, search]);
     
     return (
       <div className="relative h-screen w-screen overflow-hidden">
         <SearchHeader 
           initialQuery={decodedQuery}
           onSearch={(newQuery) => {
             router.push(`/search/${encodeURIComponent(newQuery)}`);
           }}
           isLoading={isLoading}
         />
         
         <MapPlaceholder />
         
         <DraggableContentOverlay
           content={content}
           status={status}
           error={error}
         />
       </div>
     );
   }
   ```

2. **Set up client-side navigation between searches:**
   - Handle form submissions with router.push
   - Prevent full page reloads
   - Update URL with new queries

## 8. Add Smooth Transitions (2-3 hours)

1. **Create shared element transitions:**
   - Animate search bar from center to header
   - Use layout animations for smooth positioning

2. **Add page transition animations:**
   ```typescript
   // app/components/page-transition.tsx
   export function PageTransition({ children }: { children: React.ReactNode }) {
     return (
       <motion.div
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         exit={{ opacity: 0 }}
         transition={{ duration: 0.3 }}
       >
         {children}
       </motion.div>
     );
   }
   ```

## 9. Implement Advanced Interactions (2-3 hours)

1. **Add advanced card behaviors:**
   - Double-tap to expand/collapse
   - Swipe down to dismiss
   - Momentum scrolling

2. **Add keyboard navigation:**
   - Keyboard shortcuts for expanding/collapsing
   - Focus management
   - Accessibility enhancement

## 10. Handle Edge Cases and Error States (2-3 hours)

1. **Implement error handling:**
   - Network connectivity issues
   - Empty search results
   - API failures

2. **Add fallback UI:**
   - Skeleton loading states
   - Error messages with retry options
   - Empty state design

## 11. Add URL Sync and History Management (1-2 hours)

1. **Sync URL with search state:**
   - Update URL params without full navigation
   - Handle browser back/forward navigation
   - Preserve search history

2. **Add deep linking capability:**
   - Support sharing specific search results
   - Restore state from URL params

## 12. Testing and Refinement (3-4 hours)

1. **Test main user flows:**
   - Home → Search Results
   - Search → New Search
   - Card interactions
   - Browser navigation

2. **Performance optimization:**
   - Check for unnecessary rerenders
   - Optimize animations for performance
   - Implement virtualization for large content

## 13. Mobile Experience Polish (2-3 hours)

1. **Mobile gesture refinement:**
   - Optimize touch targets
   - Fine-tune gesture sensitivity
   - Test on various device sizes

2. **Responsive adjustments:**
   - Adjust card sizes for different screens
   - Optimize for both portrait and landscape

## Implementation Timeline

**Total estimated time: 25-35 hours**

- **Phase 1 (7-10 hours):** Steps 1-3 - Basic structure, routing, context setup
- **Phase 2 (7-10 hours):** Steps 4-6 - UI components, navigation 
- **Phase 3 (6-8 hours):** Steps 7-9 - Search results page, transitions
- **Phase 4 (5-7 hours):** Steps 10-13 - Edge cases, refinement, polish

This plan covers all aspects of the implementation while ensuring a smooth, polished user experience with the draggable content overlay and seamless transitions between searches.

