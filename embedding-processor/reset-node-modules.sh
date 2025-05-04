#!/bin/bash

# This script reinstalls node modules to fix path references after directory renaming

echo "===== Resetting Node.js environment after directory rename ====="

# Remove node_modules
echo "Removing node_modules directory..."
rm -rf node_modules

# Clean npm cache
echo "Cleaning npm cache..."
npm cache clean --force

# Reinstall modules
echo "Reinstalling npm modules..."
npm install

# Test database connection
echo "Testing database connection with fixed path references..."
node test-fixed-connection.js

echo "===== Reset complete ====="
echo "If the database connection test succeeded, you should be able to run start-processors.ts now." 