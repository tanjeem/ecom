#!/bin/bash
echo "y" | npx vercel env rm TEST_VAR production >/dev/null 2>&1

while IFS='=' read -r key value; do
  # Skip empty lines, comments, and Vercel internal vars
  if [[ -z "$key" || "$key" == \#* || "$key" == "VERCEL_"* ]]; then
    continue
  fi
  
  # Remove surrounding quotes from value if present
  value="${value%\"}"
  value="${value#\"}"
  
  echo "Processing $key..."
  
  # Try to remove existing first to avoid conflicts
  echo "y" | npx vercel env rm "$key" production >/dev/null 2>&1
  echo "y" | npx vercel env rm "$key" preview >/dev/null 2>&1
  echo "y" | npx vercel env rm "$key" development >/dev/null 2>&1
  
  # Add the variable to all 3 environments
  printf "%s" "$value" | npx vercel env add "$key" production >/dev/null
  printf "%s" "$value" | npx vercel env add "$key" preview >/dev/null
  printf "%s" "$value" | npx vercel env add "$key" development >/dev/null
  
  echo "$key added successfully."
done < .env.local
