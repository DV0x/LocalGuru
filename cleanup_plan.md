# Repository Cleanup Plan

## Overview
The repository contains many files that were created during development and testing but are no longer needed for production. This document outlines a plan to clean up the repository while preserving essential files.

## Migration Files

### Keep
- All files in `supabase/migrations/` directory - These are the actual migrations that have been applied to the database and represent the current schema and functions.

### Remove
- `.history/` directory - This contains historical versions of files that are no longer needed.
- `enhanced_intent_migration.sql` - This file was used for testing but its contents have been incorporated into the proper migration file `20250313000000_enhanced_intent_search.sql`.

## Test Scripts

### Essential Test Scripts to Keep
1. **Intent Detection Tests**:
   - `test_autodetect_only.sh` - Tests auto-detection of intents for workspace queries
   - `test_meetup_query_autodetect.sh` - Tests auto-detection of intents for meetup queries
   - `intent_test.sh` - Tests the enhanced intent recognition system
   - `verify_deployment.sh` - Verifies the deployment of the enhanced intent search function

2. **Deployment Scripts**:
   - `deploy_enhanced_intent_search.sh` - Deploys the enhanced intent search function
   - `apply_migration_with_psql.sh` - Applies SQL migrations directly using psql

3. **Documentation**:
   - `intent_detection_summary.md` - Documents the test results of the enhanced intent detection system

### Test Scripts That Can Be Removed
Most of the other test scripts were created for specific testing scenarios during development and can be safely removed, including:
- Duplicate test scripts with similar functionality
- Older versions of test scripts that have been superseded by newer versions
- Debug scripts used during development
- Scripts for testing specific queries that are no longer needed

## Recommended Cleanup Actions

1. **Create a backup** of the entire repository before cleaning up.

2. **Remove the `.history/` directory** which contains historical versions of files.

3. **Organize test scripts**:
   - Move essential test scripts to a `tests/` directory
   - Remove redundant and obsolete test scripts

4. **Clean up SQL files**:
   - Remove `enhanced_intent_migration.sql` from the root directory as it's been incorporated into the proper migration

5. **Document the current state**:
   - Update README.md to reflect the current state of the project
   - Document the purpose of each essential script that remains

## Implementation Plan

1. Create a backup of the repository
2. Create a new `tests/` directory
3. Move essential test scripts to the `tests/` directory
4. Remove the `.history/` directory
5. Remove redundant test scripts
6. Update documentation

This cleanup will significantly reduce the size of the repository and make it easier to maintain going forward. 