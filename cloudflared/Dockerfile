FROM alpine:latest

# Install wget and ca-certificates
RUN apk add --no-cache wget ca-certificates

# Download and install cloudflared
RUN wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared

# Set the backend URL as an environment variable
ENV BACKEND_URL="http://fitfusion-api-gk.eastus.azurecontainer.io:8000"

# Run cloudflared tunnel
CMD cloudflared tunnel --no-autoupdate --url "${BACKEND_URL}"
