#!/bin/bash

# Script to unban IP addresses from Supabase
# Usage: ./unban-supabase-ip.sh <project_ref>

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <project_ref>"
    echo "Example: $0 abcdefghijklm"
    exit 1
fi

PROJECT_REF=$1
echo "Checking for Supabase CLI..."
if ! command -v supabase &> /dev/null; then
    echo "Supabase CLI not found. Please install it using:"
    echo "npm install -g supabase"
    exit 1
fi

# Get public IP address
echo "Detecting your current IP address..."
PUBLIC_IP=$(curl -s https://api.ipify.org)
if [ -z "$PUBLIC_IP" ]; then
    echo "Error: Could not detect your public IP address."
    exit 1
fi

echo "Your public IP address is: $PUBLIC_IP"
echo "Checking banned IPs on project $PROJECT_REF..."
BANNED_IPS=$(supabase network-bans get --project-ref $PROJECT_REF --experimental)
echo "Banned IPs:"
echo "$BANNED_IPS"

# Ask for confirmation
read -p "Do you want to unban your IP address ($PUBLIC_IP)? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Unbanning your IP address..."
    supabase network-bans remove --db-unban-ip $PUBLIC_IP --project-ref $PROJECT_REF --experimental
    echo "Done! Please wait a few moments for the changes to propagate."
    echo "You may need to restart your application for changes to take effect."
else
    echo "Operation cancelled."
fi

echo "If you want to unban a different IP address, run:"
echo "supabase network-bans remove --db-unban-ip <IP_ADDRESS> --project-ref $PROJECT_REF --experimental" 