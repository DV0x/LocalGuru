# LocalGuru Search Components

## Search Component Styling

The search functionality uses CSS modules for consistent styling across environments. This approach ensures that:

1. Both local and production environments render identical styles
2. CSS specificity issues are avoided
3. Search components maintain the same width (max-w-4xl / 56rem) as other containers

## Key Files:

- `search-styles.module.css`: Contains all search-related styles
- `search-bar.tsx`: Main search input
- `floating-search-bar.tsx`: Secondary search that appears when scrolling

## Potential Issues:

If styling issues appear in production but not locally:

1. **Ensure CSS is being bundled correctly**: Check Next.js build output
2. **Check browser caching**: Hard refresh the page to get the latest CSS
3. **Verify CSS module imports**: Make sure the styles are imported and applied correctly
4. **Inspect element**: Compare CSS classes and specificity between environments 