# Supabase Integration for LocalGuru

This directory contains utility functions for integrating Supabase with our Next.js application.

## File Structure

- `client.ts` - Client-side Supabase utility (for use in Client Components with 'use client')
- `server.ts` - Server-side Supabase utility (for use in Server Components and API Routes)

## Usage

### Client-Side Usage

For client components, import and use the `getSupabaseClient` function:

```tsx
'use client'
import { getSupabaseClient } from '@/utils/supabase/client'

export default function MyClientComponent() {
  // Use the client in event handlers, useEffect, etc.
  const handleClick = async () => {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('your_table').select()
    // Handle the result
  }
  
  return <button onClick={handleClick}>Fetch Data</button>
}
```

### Server-Side Usage

For server components, import and use the `getServerSupabaseClient` function:

```tsx
import { getServerSupabaseClient } from '@/utils/supabase/server'

export default async function MyServerComponent() {
  const supabase = getServerSupabaseClient()
  const { data, error } = await supabase.from('your_table').select()
  
  // Render with the data
  return <div>{/* Your UI */}</div>
}
```

For server actions, use the `getServerActionSupabaseClient` function:

```tsx
import { getServerActionSupabaseClient } from '@/utils/supabase/server'

export async function myServerAction(formData: FormData) {
  'use server'
  const supabase = getServerActionSupabaseClient()
  // Use Supabase in your server action
}
```

## Required Environment Variables

Make sure you have the following variables in your `.env.local` file:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Testing the Connection

You can test your Supabase connection by visiting `/supabase-test` in your application. 