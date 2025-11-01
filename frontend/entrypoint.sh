#!/bin/sh
# Entrypoint script that injects runtime config into the frontend

# Read API URL from environment variable (set by Cloud Run)
API_URL=${VITE_API_URL:-""}

# Log for debugging (visible in Cloud Run logs)
if [ -z "$API_URL" ]; then
  echo "WARNING: VITE_API_URL environment variable is not set"
else
  echo "Injecting API URL: $API_URL"
fi

# Generate config.js file with the API URL
# Use proper JSON escaping for the URL
cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = {
  API_URL: "${API_URL}"
};
EOF

# Verify config.js was created
if [ -f /usr/share/nginx/html/config.js ]; then
  echo "Config file created successfully"
  echo "Config file contents:"
  cat /usr/share/nginx/html/config.js
else
  echo "ERROR: Failed to create config.js file"
fi

# Start nginx
exec nginx -g "daemon off;"

