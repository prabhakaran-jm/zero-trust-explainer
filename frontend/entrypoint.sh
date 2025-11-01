#!/bin/sh
# Entrypoint script that injects runtime config into the frontend

# Read environment variables (set by Cloud Run)
API_URL=${VITE_API_URL:-""}
DEMO_VIDEO_URL=${VITE_DEMO_VIDEO_URL:-""}
REPO_URL=${VITE_REPO_URL:-""}
ARCH_URL=${VITE_ARCH_URL:-""}
AI_STUDIO_URL=${VITE_AI_STUDIO_URL:-""}

# Log for debugging (visible in Cloud Run logs)
if [ -z "$API_URL" ]; then
  echo "WARNING: VITE_API_URL environment variable is not set"
else
  echo "Injecting API URL: $API_URL"
fi

# Generate config.js file with all runtime config values
# Use proper JSON escaping for URLs
cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = {
  API_URL: "${API_URL}",
  DEMO_VIDEO_URL: "${DEMO_VIDEO_URL}",
  REPO_URL: "${REPO_URL}",
  ARCH_URL: "${ARCH_URL}",
  AI_STUDIO_URL: "${AI_STUDIO_URL}"
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

