import { NextRequest, NextResponse } from 'next/server';

// Detect mobile devices based on user agent
const isMobile = (userAgent: string): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
};

export function middleware(request: NextRequest) {
  // Get the user agent
  const userAgent = request.headers.get('user-agent') || '';
  
  // Check if it's a mobile device
  if (isMobile(userAgent)) {
    // Don't redirect if already on the PWA or accessing API routes
    if (request.nextUrl.pathname.startsWith('/api') || 
        request.nextUrl.host.includes('pwa')) {
      return NextResponse.next();
    }
    
    // Get the current URL to preserve path and query params
    const url = request.nextUrl.clone();
    
    // Change the hostname/port to the PWA app
    // In development, redirect to localhost:3001
    if (process.env.NODE_ENV === 'development') {
      const pwaDevelopmentUrl = 'http://localhost:3001' + url.pathname + url.search;
      return NextResponse.redirect(pwaDevelopmentUrl);
    }
    
    // In production, you might use a subdomain like pwa.yourdomain.com
    // or a path like yourdomain.com/pwa
    // const pwaProductionUrl = 'https://pwa.yourdomain.com' + url.pathname + url.search;
    // return NextResponse.redirect(pwaProductionUrl);
    
    // For now, we'll just use the dev URL even in production
    const pwaUrl = 'http://localhost:3001' + url.pathname + url.search;
    return NextResponse.redirect(pwaUrl);
  }
  
  // Not a mobile device, continue to the web app
  return NextResponse.next();
}

// Only run the middleware on the following paths
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * 1. /api routes
     * 2. /_next (Next.js internals)
     * 3. All files in /public (e.g. favicon.ico)
     */
    '/((?!api|_next|.*\\..*|favicon.ico).*)',
  ],
}; 