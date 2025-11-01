#!/bin/sh
# Entrypoint script that injects runtime config into the frontend

# Read API URL from environment variable (set by Cloud Run)
API_URL=${VITE_API_URL:-""}

# Generate config.js file with the API URL
cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = {
  API_URL: "${API_URL}"
};
EOF

# Start nginx
exec nginx -g "daemon off;"

