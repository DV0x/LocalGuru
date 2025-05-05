# Path Resolution Issues - Approaches Attempted

## Problem Statement

The application is failing to build on Vercel with consistent module resolution errors:

```
Module not found: Can't resolve '../utils/csrf'
Module not found: Can't resolve '../utils/supabase/client-server'
Module not found: Can't resolve '../utils/api-key-middleware'
Module not found: Can't resolve '../utils/search/query-processor'
Module not found: Can't resolve '../utils/api-response'
```

Despite multiple approaches, the problem persists. The issue appears specific to Vercel's build environment.

## Attempted Solutions

### 1. Using Path Aliases with @/app/lib

**Description:**
The original approach used path aliases with the pattern `@/app/lib/utils/...`

**Implementation:**
- Files located in `/app/lib/utils/`
- Imported with `@/app/lib/utils/api-response`
- Configured in tsconfig.json and next.config.js

**Result:** ❌ Failed
```
Module not found: Can't resolve '@/app/lib/utils/api-response'
```

### 2. Creating Top-Level /lib Directory

**Description:**
Moved utility files to a top-level `/lib` directory to simplify imports

**Implementation:**
- Created `/lib/utils/`, `/lib/search/`, etc.
- Copied files from `/app/lib/...` to `/lib/...`
- Updated tsconfig.json with `"@/lib/*": ["./lib/*"]`
- Updated imports to use `@/lib/utils/...`

**Result:** ❌ Failed
```
Module not found: Can't resolve '@/lib/utils/api-response'
```

### 3. Direct Relative Paths (../../../)

**Description:**
Replaced alias imports with direct relative paths

**Implementation:**
- Used `../../../utils/api-response` instead of `@/utils/api-response`
- Created script to automatically calculate correct relative paths
- Modified all API routes to use relative imports

**Result:** ❌ Failed
```
Module not found: Can't resolve '../../../utils/csrf'
```

### 4. Simplifying to Top-Level /utils

**Description:**
Restructured to follow Next.js conventions with a top-level utils directory

**Implementation:**
- Created `/utils/` directory with subdirectories
- Added path mapping in tsconfig.json: `"@/utils/*": ["./utils/*"]`
- Updated imports to use `@/utils/...`

**Result:** ❌ Failed
```
Module not found: Can't resolve '@/utils/csrf'
```

### 5. Moving Utils Into App Directory

**Description:**
Moved utility files directly into the app directory structure

**Implementation:**
- Created `/app/utils/` with subdirectories
- Copied all utility files from top-level `/utils/` into `/app/utils/`
- Updated imports to use `../utils/...` relative to the API routes
- Simplified relative paths to be shorter and more direct

**Result:** ❌ Failed
```
Module not found: Can't resolve '../utils/csrf'
```

## Observations

1. The error is consistent across all approaches, suggesting it's specific to Vercel's build environment
2. The issue occurs regardless of import style (alias or relative)
3. The problem appears with the same files (csrf, api-key-middleware, etc.)
4. Local development works fine with all approaches

## Next Steps to Consider

1. **Inline the code:** Copy the utility code directly into the API route files
2. **Create route-specific utils:** Duplicate the utility files in each API route directory
3. **Reorganize to pages directory:** Try using the older pages directory structure instead of app router
4. **Vercel specific configuration:** Explore Vercel.json or other Vercel-specific settings
5. **Contact Vercel support:** Provide detailed information about the issue for their assistance
6. **Try different transpilation settings:** Adjust the transpilePackages configuration in next.config.js
7. **Troubleshoot with simpler project:** Create a minimal reproduction to isolate the issue 