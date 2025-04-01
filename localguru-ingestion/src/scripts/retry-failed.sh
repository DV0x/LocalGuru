#!/bin/bash

# This script identifies failed quarters by analyzing logs and reruns them
echo "===== AskSF Failed Quarter Recovery ====="
echo "This script will identify and rerun failed quarters"

# Find failed quarters from logs
echo "Analyzing logs for failed quarters..."
FAILED_QUARTERS=$(grep -a "Failed to process quarter" logs/asksf-resilient.log | grep -oE "quarter [0-9]+" | sed 's/quarter //' | sort -n | uniq)

if [ -z "$FAILED_QUARTERS" ]; then
  echo "No failed quarters found in logs!"
  exit 0
fi

echo "Found failed quarters: $FAILED_QUARTERS"
echo ""

# Create a temporary script to run just these quarters
echo "Creating temporary script to rerun failed quarters..."

cat > src/scripts/asksf-retry.ts << EOL
/**
 * Automatically generated script to retry failed quarters
 * Generated on: $(date)
 */

import { exec } from 'child_process';
import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = util.promisify(exec);
const failedQuarters = [$(echo $FAILED_QUARTERS | tr ' ' ',')];

console.log('===== RETRYING FAILED QUARTERS =====');
console.log(\`Will retry \${failedQuarters.length} failed quarters: \${failedQuarters.join(', ')}\`);

async function runQuarter(quarterIndex: number): Promise<void> {
  console.log(\`\\n\\n===== RETRYING QUARTER \${quarterIndex} =====\`);
  
  try {
    // Modify quarterIndex in the script temporarily
    const scriptPath = path.join(process.cwd(), 'src/scripts/asksf-resilient.ts');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    
    // Replace the quarterIndex in the script
    const modifiedContent = scriptContent.replace(
      /const quarterIndex = 0;/,
      \`const quarterIndex = \${quarterIndex}; // Modified by retry script\`
    );
    
    // Write the modified content to a temporary file
    const tempScriptPath = path.join(process.cwd(), 'src/scripts/temp-script.ts');
    fs.writeFileSync(tempScriptPath, modifiedContent);
    
    // Run the modified script
    const { stdout, stderr } = await execAsync('npx ts-node --transpile-only src/scripts/temp-script.ts');
    console.log(stdout);
    if (stderr) console.error(stderr);
    
    // Clean up
    fs.unlinkSync(tempScriptPath);
    console.log(\`\\n\\n✅ Quarter \${quarterIndex} processing complete\`);
  } catch (error) {
    console.error(\`Error running quarter \${quarterIndex}: \${error.message}\`);
    console.error(\`\\n\\n❌ Quarter \${quarterIndex} processing failed\`);
  }
}

async function runAllFailedQuarters(): Promise<void> {
  for (const quarterIndex of failedQuarters) {
    await runQuarter(quarterIndex);
  }
  console.log('\\n\\n===== ALL FAILED QUARTERS REPROCESSED =====');
}

runAllFailedQuarters().catch(console.error);
EOL

echo "Temporary script created. Now running failed quarters..."
echo ""

# Run the temporary script
npx ts-node src/scripts/asksf-retry.ts

echo ""
echo "===== Recovery process complete =====" 