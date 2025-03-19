#!/bin/bash

# Comprehensive Repository Cleanup Script
# This script combines all cleanup operations to organize and clean the repository

echo "======================================================"
echo "🧹 COMPREHENSIVE REPOSITORY CLEANUP"
echo "======================================================"

# Create a master backup of the entire repository before cleaning
echo "📦 Creating master backup of the repository..."
MASTER_BACKUP_DIR="../localguru_master_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$MASTER_BACKUP_DIR"
cp -R . "$MASTER_BACKUP_DIR"
echo "✅ Master backup created at $MASTER_BACKUP_DIR"
echo

# PART 1: Clean up test scripts and organize essential scripts
echo "🔍 PART 1: Cleaning up test scripts and organizing essential scripts..."
echo

# Create tests directory if it doesn't exist
echo "📁 Creating tests directory..."
mkdir -p tests
echo "✅ Tests directory created"
echo

# Move essential test scripts to tests directory
echo "🔄 Moving essential test scripts to tests directory..."
ESSENTIAL_SCRIPTS=(
  "test_autodetect_only.sh"
  "test_meetup_query_autodetect.sh"
  "intent_test.sh"
  "verify_deployment.sh"
  "deploy_enhanced_intent_search.sh"
  "apply_migration_with_psql.sh"
  "intent_detection_summary.md"
)

for script in "${ESSENTIAL_SCRIPTS[@]}"; do
  if [ -f "$script" ]; then
    cp "$script" "tests/"
    echo "  ✓ Copied $script to tests/"
  fi
done
echo "✅ Essential scripts moved to tests directory"
echo

# Remove temporary script files
echo "🗑️ Removing temporary script files..."
TEMP_SCRIPTS=$(find . -maxdepth 1 -name "*.sh" | grep -v "complete_cleanup.sh")
for script in $TEMP_SCRIPTS; do
  KEEP=false
  for essential in "${ESSENTIAL_SCRIPTS[@]}"; do
    if [[ "$script" == *"$essential"* ]]; then
      KEEP=true
      break
    fi
  done
  
  if [ "$KEEP" = false ]; then
    echo "  ✓ Removing $(basename "$script")"
    rm "$script"
  fi
done
echo "✅ Temporary script files removed"
echo

# Remove original copies of essential scripts
echo "🗑️ Removing original copies of essential scripts..."
for script in "${ESSENTIAL_SCRIPTS[@]}"; do
  if [ -f "$script" ]; then
    rm "$script"
    echo "  ✓ Removed original copy of $script"
  fi
done
echo "✅ Original copies of essential scripts removed"
echo

# PART 2: Clean up JSON files
echo "🔍 PART 2: Cleaning up JSON files..."
echo

# List of essential JSON files to keep
ESSENTIAL_JSON=(
  "package.json"
  "tsconfig.json"
  "components.json"
)

# Remove temporary JSON files
echo "🗑️ Removing temporary JSON files..."
REMOVED_COUNT_JSON=0

for json_file in $(find . -maxdepth 1 -name "*.json"); do
  filename=$(basename "$json_file")
  
  # Check if this is an essential file
  KEEP=false
  for essential in "${ESSENTIAL_JSON[@]}"; do
    if [ "$filename" = "$essential" ]; then
      KEEP=true
      break
    fi
  done
  
  if [ "$KEEP" = false ]; then
    echo "  ✓ Removing $filename"
    rm "$json_file"
    REMOVED_COUNT_JSON=$((REMOVED_COUNT_JSON + 1))
  else
    echo "  ℹ️ Keeping essential file: $filename"
  fi
done

echo "✅ Removed $REMOVED_COUNT_JSON temporary JSON files"
echo

# PART 3: Clean up SQL files
echo "🔍 PART 3: Cleaning up SQL files..."
echo

# List of essential SQL files to keep
ESSENTIAL_SQL=(
  "enhanced_intent_multi_strategy_search.sql"
  "improve_search_relevance.sql"
  "utility_functions.sql"
)

# Create SQL directory for organized storage
echo "📁 Creating sql directory for essential SQL files..."
mkdir -p sql

# Remove temporary SQL files and organize essential ones
echo "🗑️ Removing temporary SQL files..."
REMOVED_COUNT_SQL=0

for sql_file in $(find . -maxdepth 1 -name "*.sql"); do
  filename=$(basename "$sql_file")
  
  # Check if this is an essential file
  KEEP=false
  for essential in "${ESSENTIAL_SQL[@]}"; do
    if [ "$filename" = "$essential" ]; then
      KEEP=true
      mv "$sql_file" "sql/"
      echo "  ✓ Moved $filename to sql directory"
      break
    fi
  done
  
  if [ "$KEEP" = false ]; then
    echo "  ✓ Removing $filename"
    rm "$sql_file"
    REMOVED_COUNT_SQL=$((REMOVED_COUNT_SQL + 1))
  fi
done

echo "✅ Removed $REMOVED_COUNT_SQL temporary SQL files"
echo "✅ Essential SQL files organized in sql directory"
echo

# PART 4: Remove .history directory if it exists
echo "🔍 PART 4: Removing .history directory..."
if [ -d ".history" ]; then
  rm -rf .history
  echo "✅ .history directory removed"
else
  echo "✅ .history directory not found (already removed)"
fi
echo

# Create READMEs for organized directories
echo "📝 Creating README for tests directory..."
cat > tests/README.md << EOF
# Intent Detection System Tests

This directory contains essential test scripts for the enhanced intent detection system.

## Test Scripts

- \`test_autodetect_only.sh\` - Tests auto-detection of intents for workspace queries
- \`test_meetup_query_autodetect.sh\` - Tests auto-detection of intents for meetup queries
- \`intent_test.sh\` - Tests the enhanced intent recognition system
- \`verify_deployment.sh\` - Verifies the deployment of the enhanced intent search function

## Deployment Scripts

- \`deploy_enhanced_intent_search.sh\` - Deploys the enhanced intent search function
- \`apply_migration_with_psql.sh\` - Applies SQL migrations directly using psql

## Documentation

- \`intent_detection_summary.md\` - Documents the test results of the enhanced intent detection system
EOF

echo "📝 Creating README for sql directory..."
cat > sql/README.md << EOF
# Essential SQL Files

This directory contains essential SQL files for the enhanced intent detection system.

## Files

- \`enhanced_intent_multi_strategy_search.sql\` - SQL function implementing multi-strategy search with intent-based boosting
- \`improve_search_relevance.sql\` - SQL functions for improving search relevance
- \`utility_functions.sql\` - Utility SQL functions used by the search system
EOF

echo "✅ READMEs created for organized directories"
echo

echo "======================================================"
echo "✨ COMPREHENSIVE REPOSITORY CLEANUP COMPLETE"
echo "======================================================"
echo
echo "The following actions were taken:"
echo "1. Created a master backup of the repository at $MASTER_BACKUP_DIR"
echo "2. Created a tests directory and moved essential scripts there"
echo "3. Removed temporary script files"
echo "4. Removed original copies of essential scripts"
echo "5. Removed temporary JSON files (kept essential configuration files)"
echo "6. Organized essential SQL files in sql/ directory and removed temporary SQL files"
echo "7. Removed .history directory (if it existed)"
echo "8. Created README files for the tests and sql directories"
echo
echo "The repository has been successfully cleaned up and organized."
echo "======================================================" 