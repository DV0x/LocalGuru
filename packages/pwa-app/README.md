# LocalGuru PWA

This is the mobile-focused Progressive Web App (PWA) for LocalGuru.

## Environment Variables

Before running the PWA, you need to set up environment variables for Supabase:

1. Create a `.env.local` file in the `packages/pwa-app` directory
2. Add the following environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Use the same Supabase credentials as in the web-app.

## Development

```bash
# From the root directory
pnpm run dev:pwa

# Or from the pwa-app directory
pnpm run dev
```

The PWA will run on http://localhost:3001. 