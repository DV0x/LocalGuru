# Web Application Architecture

## Overview

The web application is built using Next.js 14 with React and TypeScript. It follows a modern approach with Server Components as the default and Client Components where necessary for interactivity.

## Directory Structure

```
app/
├── api/           # API routes for backend functionality
├── components/    # Shared UI components
├── lib/           # Utility functions and shared libraries
├── page.tsx       # Main page component
├── layout.tsx     # Root layout component
└── globals.css    # Global styles

components/        # Global components (outside app directory)
├── ui/            # UI components
└── ...

hooks/             # Custom React hooks

utils/             # Utility functions
```

## Key Components

### Frontend

1. **Page Components**
   - Server components that render the main pages of the application
   - Use hybrid data fetching (server-side and client-side)

2. **UI Components**
   - Reusable UI elements built with TailwindCSS
   - Most components use the Server Component pattern
   - Interactive components use the Client Component pattern with "use client" directive

3. **Layouts**
   - Define the overall page structure and shared UI elements
   - Implement responsive design patterns

### Backend

1. **API Routes**
   - Next.js API routes for server-side functionality
   - Handle search requests, user authentication, and other backend tasks

2. **Supabase Client**
   - Integration with Supabase for database access
   - Authentication and authorization

## Data Flow

1. **Server-side Rendering (SSR)**
   - Pages are primarily rendered on the server
   - Initial data is fetched during server rendering

2. **Client-side Interactions**
   - User interactions trigger client-side updates
   - Search queries are processed through API routes

3. **Search Processing**
   - User search queries are sent to backend
   - Backend calls Supabase database functions
   - Results are processed and returned to the frontend

## Search Implementation

The application implements a sophisticated search interface that:

1. Sends user queries to the backend
2. Processes queries using the `comment_only_search_with_timeout` function
3. Renders search results with proper formatting
4. Supports pagination and filtering of results
5. Handles timeouts gracefully with fallback to text-only search

## Authentication & Authorization

User authentication is handled through Supabase Auth with:

1. Email/password login
2. Social login options
3. Role-based access control
4. Protected routes using middleware

## Performance Optimizations

1. **Server Components**
   - Reduce JavaScript bundle size
   - Move computation to the server where appropriate

2. **Image Optimization**
   - Use of Next.js Image component
   - Automatic image optimization

3. **Incremental Adoption of React Server Components**
   - Gradual migration to Server Components where appropriate
   - Client Components reserved for interactive UI elements

4. **Caching Strategy**
   - Server-side caching for expensive operations
   - Client-side caching for frequently accessed data

## Error Handling

1. **Error Boundaries**
   - Isolate errors to prevent entire app crashes
   - Provide fallback UI during errors

2. **Loading States**
   - Skeleton loaders during data fetching
   - Spinners for user interactions

3. **Structured Error Responses**
   - Consistent error format from backend
   - User-friendly error messages

## Deployment

The application is deployed using Vercel with:

1. Preview deployments for pull requests
2. Automatic deployments for main branch
3. Environment variables management
4. Analytics and monitoring 