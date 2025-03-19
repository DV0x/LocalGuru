#!/bin/bash

# Format JSON for better readability
echo "Formatting outdoor-sf-results.json for better readability..."

# Check if jq is installed
if command -v jq &> /dev/null; then
    # Use jq for pretty formatting (preferred method)
    jq '.' outdoor-sf-results.json > outdoor-sf-results-formatted.json
    echo "JSON formatted successfully with jq"
    echo "Formatted file saved to: outdoor-sf-results-formatted.json"
else
    # Alternative using Python if jq is not available
    if command -v python3 &> /dev/null; then
        python3 -c '
import json
import sys

with open("outdoor-sf-results.json", "r") as f:
    data = json.load(f)
    
with open("outdoor-sf-results-formatted.json", "w") as f:
    json.dump(data, f, indent=2)

print("JSON formatted successfully with Python")
' 
        echo "Formatted file saved to: outdoor-sf-results-formatted.json"
    elif command -v python &> /dev/null; then
        python -c '
import json
import sys

with open("outdoor-sf-results.json", "r") as f:
    data = json.load(f)
    
with open("outdoor-sf-results-formatted.json", "w") as f:
    json.dump(data, f, indent=2)

print("JSON formatted successfully with Python")
' 
        echo "Formatted file saved to: outdoor-sf-results-formatted.json"
    else
        echo "Error: Neither jq nor Python is available to format the JSON"
        echo "Please install jq or Python to format JSON files"
        exit 1
    fi
fi

# Show the top and bottom of the formatted file
echo -e "\nShowing first 10 lines of formatted JSON:"
head -n 10 outdoor-sf-results-formatted.json

echo -e "\nFile has been saved to outdoor-sf-results-formatted.json" 