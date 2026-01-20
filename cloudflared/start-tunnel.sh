#!/bin/sh

# Install cloudflared
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Get backend URL from environment variable or use default
BACKEND_URL=${BACKEND_URL:-"http://fitfusion-api-gk.eastus.azurecontainer.io:8000"}

echo "Starting Cloudflare Tunnel to ${BACKEND_URL}"

# Start the tunnel (this will output the HTTPS URL to logs)
cloudflared tunnel --no-autoupdate --url "${BACKEND_URL}"
