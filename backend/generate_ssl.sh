#!/bin/bash
# Generate self-signed SSL certificate for development/testing
# For production, use Let's Encrypt or a proper CA-signed certificate

mkdir -p /app/ssl

# Generate self-signed certificate valid for 365 days
openssl req -x509 -newkey rsa:4096 -nodes \
  -out /app/ssl/cert.pem \
  -keyout /app/ssl/key.pem \
  -days 365 \
  -subj "/C=US/ST=State/L=City/O=FitFusion/OU=IT/CN=fitfusion-api-gk.eastus.azurecontainer.io"

echo "✅ SSL certificates generated in /app/ssl/"
ls -lh /app/ssl/
