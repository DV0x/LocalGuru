# Client-Side Security Plan

This guide focuses on securing your frontend application without relying on user authentication.

## 1. Content Security Policy (CSP)

### Priority: High
### Timeline: First week

Your middleware already implements CSP headers, but let's enhance and understand them:

1. **Understand your current CSP:**
   ```typescript
   // In middleware.ts
   response.headers.set(
     'Content-Security-Policy',
     "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://*.supabase.co;"
   );
   ```

2. **Update CSP for better security:**
   ```typescript
   // Enhanced CSP with more specific rules
   response.headers.set(
     'Content-Security-Policy',
     "default-src 'self'; " +
     "script-src 'self' 'unsafe-inline'; " +
     "style-src 'self' 'unsafe-inline'; " +
     "img-src 'self' data: https://secure-images.cdn.example.com; " +
     "font-src 'self' data: https://fonts.gstatic.com; " +
     "connect-src 'self' https://*.supabase.co https://api.anthropic.com; " +
     "frame-ancestors 'none'; " +
     "form-action 'self'; " +
     "base-uri 'self'; " +
     "object-src 'none';"
   );
   ```

3. **Create a CSP reporting endpoint:**
   ```typescript
   // app/api/csp-report/route.ts
   import { NextRequest, NextResponse } from 'next/server';

   export async function POST(request: NextRequest) {
     try {
       const report = await request.json();
       
       // Log CSP violations
       console.error('CSP Violation:', {
         blockedURI: report['csp-report']?.['blocked-uri'],
         violatedDirective: report['csp-report']?.['violated-directive'],
         documentURI: report['csp-report']?.['document-uri'],
         timestamp: new Date().toISOString()
       });
       
       return NextResponse.json({ success: true });
     } catch (error) {
       console.error('Error processing CSP report:', error);
       return NextResponse.json({ error: 'Failed to process report' }, { status: 500 });
     }
   }
   ```

4. **Enable CSP reporting:**
   ```typescript
   // Add to middleware.ts
   response.headers.set(
     'Content-Security-Policy-Report-Only',
     "default-src 'self'; " +
     // Same as your main CSP...
     "report-uri /api/csp-report;"
   );
   ```

## 2. Cross-Site Scripting (XSS) Prevention

### Priority: Critical
### Timeline: Immediate (before deployment)

1. **Install DOMPurify:**
   ```bash
   npm install dompurify @types/dompurify
   ```

2. **Create a safe HTML component:**
   ```tsx
   // components/ui/safe-html.tsx
   'use client';
   
   import DOMPurify from 'dompurify';
   import { useEffect, useRef } from 'react';

   interface SafeHtmlProps {
     html: string;
     className?: string;
   }

   export default function SafeHtml({ html, className }: SafeHtmlProps) {
     const containerRef = useRef<HTMLDivElement>(null);
     
     useEffect(() => {
       // Configure DOMPurify
       DOMPurify.setConfig({
         ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'br'],
         ALLOWED_ATTR: ['href', 'target', 'rel'],
         FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
         ADD_ATTR: ['target', 'rel'],
       });
       
       // Add hook to make all links open in new tab with security attributes
       DOMPurify.addHook('afterSanitizeAttributes', function(node) {
         if (node.tagName === 'A') {
           node.setAttribute('target', '_blank');
           node.setAttribute('rel', 'noopener noreferrer');
         }
       });
     }, []);
     
     return (
       <div 
         ref={containerRef}
         className={className} 
         dangerouslySetInnerHTML={{ 
           __html: DOMPurify.sanitize(html)
         }} 
       />
     );
   }
   ```

3. **Use the SafeHtml component for all user-generated content:**
   ```tsx
   // Wherever you display search results or content
   import SafeHtml from '@/components/ui/safe-html';
   
   export function SearchResult({ result }: { result: SearchResult }) {
     return (
       <div className="search-result">
         <h3>{result.title}</h3>
         <SafeHtml html={result.content} className="search-content" />
       </div>
     );
   }
   ```

4. **Add client-side JSON validation:**
   ```typescript
   // lib/utils/safe-json-parse.ts
   export function safeJsonParse<T>(jsonString: string, fallback: T): T {
     try {
       // First, check for dangerous patterns
       if (
         jsonString.includes('<script') || 
         jsonString.includes('javascript:') ||
         jsonString.includes('on')
       ) {
         console.error('Potentially dangerous JSON content detected');
         return fallback;
       }
       
       return JSON.parse(jsonString) as T;
     } catch (error) {
       console.error('Failed to parse JSON:', error);
       return fallback;
     }
   }
   ```

## 3. Cross-Site Request Forgery (CSRF) Protection

### Priority: Medium
### Timeline: First week

Even without authentication, CSRF protection is valuable:

1. **Add a simple CSRF token implementation:**
   ```typescript
   // lib/utils/csrf.ts
   import { cookies } from 'next/headers';
   import crypto from 'crypto';

   export function generateCsrfToken(): string {
     const token = crypto.randomBytes(16).toString('hex');
     cookies().set('csrf_token', token, {
       httpOnly: true,
       secure: process.env.NODE_ENV === 'production',
       sameSite: 'strict',
       path: '/',
       maxAge: 3600 // 1 hour
     });
     return token;
   }

   export function validateCsrfToken(token: string): boolean {
     const cookieToken = cookies().get('csrf_token')?.value;
     return !!cookieToken && token === cookieToken;
   }
   ```

2. **Implement CSRF checking middleware:**
   ```typescript
   // lib/utils/csrf-middleware.ts
   import { NextRequest, NextResponse } from 'next/server';
   import { validateCsrfToken } from './csrf';

   export function csrfProtection(req: NextRequest) {
     // Only apply to mutation endpoints
     if (
       req.method !== 'GET' && 
       req.method !== 'HEAD' && 
       req.method !== 'OPTIONS' &&
       req.nextUrl.pathname.startsWith('/api/')
     ) {
       const csrfToken = req.headers.get('X-CSRF-Token');
       
       if (!csrfToken || !validateCsrfToken(csrfToken)) {
         return NextResponse.json(
           { error: 'Invalid CSRF token' },
           { status: 403 }
         );
       }
     }
     
     return NextResponse.next();
   }
   ```

3. **Client-side CSRF handling:**
   ```tsx
   // hooks/use-csrf.ts
   'use client';
   
   import { useState, useEffect } from 'react';

   export function useCsrfToken() {
     const [csrfToken, setCsrfToken] = useState<string | null>(null);
     
     useEffect(() => {
       // Fetch a CSRF token on mount
       fetch('/api/csrf-token')
         .then(res => res.json())
         .then(data => setCsrfToken(data.token))
         .catch(err => console.error('Failed to fetch CSRF token:', err));
     }, []);
     
     return csrfToken;
   }
   ```

4. **Create CSRF token endpoint:**
   ```typescript
   // app/api/csrf-token/route.ts
   import { NextResponse } from 'next/server';
   import { generateCsrfToken } from '@/lib/utils/csrf';

   export async function GET() {
     const token = generateCsrfToken();
     return NextResponse.json({ token });
   }
   ```

## 4. Secure Local Storage Usage

### Priority: Medium
### Timeline: First week

1. **Create encrypted local storage utility:**
   ```typescript
   // lib/utils/secure-storage.ts
   'use client';
   
   // Simple encryption using a static key (not truly secure, but better than plaintext)
   function encrypt(text: string): string {
     // In a real implementation, use a more robust encryption method
     return btoa(text); // Base64 encoding (not encryption)
   }
   
   function decrypt(encryptedText: string): string {
     try {
       return atob(encryptedText); // Base64 decoding
     } catch (e) {
       return '';
     }
   }
   
   export const secureStorage = {
     setItem(key: string, value: any): void {
       try {
         const encryptedValue = encrypt(JSON.stringify(value));
         localStorage.setItem(`secure_${key}`, encryptedValue);
       } catch (e) {
         console.error('Failed to store item securely:', e);
       }
     },
     
     getItem<T>(key: string, defaultValue: T): T {
       try {
         const encryptedValue = localStorage.getItem(`secure_${key}`);
         if (!encryptedValue) return defaultValue;
         
         const decryptedValue = decrypt(encryptedValue);
         return JSON.parse(decryptedValue) as T;
       } catch (e) {
         console.error('Failed to retrieve item securely:', e);
         return defaultValue;
       }
     },
     
     removeItem(key: string): void {
       localStorage.removeItem(`secure_${key}`);
     },
     
     clear(): void {
       // Only clear items with the 'secure_' prefix
       Object.keys(localStorage).forEach(key => {
         if (key.startsWith('secure_')) {
           localStorage.removeItem(key);
         }
       });
     }
   };
   ```

2. **Use for sensitive client-side storage:**
   ```typescript
   // Using the secure storage
   import { secureStorage } from '@/lib/utils/secure-storage';

   // Store user preferences
   secureStorage.setItem('searchPreferences', {
     defaultLocation: 'San Francisco',
     resultsPerPage: 20
   });

   // Retrieve preferences
   const preferences = secureStorage.getItem('searchPreferences', {
     defaultLocation: '',
     resultsPerPage: 10
   });
   ```

## 5. Clickjacking Protection

### Priority: Medium
### Timeline: First week

1. **Add X-Frame-Options header (already in your middleware):**
   ```typescript
   // This is already in your middleware:
   response.headers.set('X-Frame-Options', 'DENY');
   ```

2. **Add frame-ancestors to CSP (as mentioned above):**
   ```typescript
   // In your CSP:
   "frame-ancestors 'none'; "
   ```

3. **Implement JavaScript frame detection:**
   ```typescript
   // app/layout.tsx
   export default function RootLayout({
     children,
   }: {
     children: React.ReactNode
   }) {
     return (
       <html lang="en">
         <head>
           {/* Frame busting script */}
           <script dangerouslySetInnerHTML={{
             __html: `
               if (window.self !== window.top) {
                 window.top.location.href = window.self.location.href;
               }
             `
           }} />
         </head>
         <body>{children}</body>
       </html>
     )
   }
   ```

## Implementation Plan

### Day 1
- [ ] Implement DOMPurify with the SafeHtml component
- [ ] Update layout.tsx with frame-busting script
- [ ] Verify CSP headers in middleware

### Week 1
- [ ] Set up CSP reporting endpoint
- [ ] Implement CSRF protection
- [ ] Create secure storage utility
- [ ] Test XSS prevention with sample inputs

### Week 2
- [ ] Review and monitor CSP violation reports
- [ ] Perform XSS testing and fix any issues
- [ ] Document client-side security measures
- [ ] Create a security checklist for developers 