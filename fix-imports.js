const fs = require('fs');
const path = require('path');

// Fix debug route
const debugRoutePath = './app/api/debug/route.ts';
let content = fs.readFileSync(debugRoutePath, 'utf8');
content = content.replace(
  "import { supabaseAdmin } from '@/lib/supabase/client-server';",
  "import { supabaseAdmin } from '@/app/lib/supabase/client-server';"
);
content = content.replace(
  "import { withApiKeyValidation } from '@/lib/utils/api-key-middleware';",
  "import { withApiKeyValidation } from '@/app/lib/utils/api-key-middleware';"
);
fs.writeFileSync(debugRoutePath, content);
console.log('Updated debug route');

// Fix embeddings route
const embeddingsRoutePath = './app/api/embeddings/route.ts';
content = fs.readFileSync(embeddingsRoutePath, 'utf8');
content = content.replace(
  "import { generateEmbeddings } from '@/lib/search/query-processor';",
  "import { generateEmbeddings } from '@/app/lib/search/query-processor';"
);
content = content.replace(
  "import { successResponse, errorResponse } from '@/lib/utils/api-response';",
  "import { successResponse, errorResponse } from '@/app/lib/utils/api-response';"
);
content = content.replace(
  "import { handleApiError, logApiError } from '@/lib/utils/error-handling';",
  "import { handleApiError, logApiError } from '@/app/lib/utils/error-handling';"
);
content = content.replace(
  "import { withApiKeyValidation } from '@/lib/utils/api-key-middleware';",
  "import { withApiKeyValidation } from '@/app/lib/utils/api-key-middleware';"
);
fs.writeFileSync(embeddingsRoutePath, content);
console.log('Updated embeddings route'); 