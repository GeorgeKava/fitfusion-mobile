# HTTPS Setup Guide for FitFusion Backend

## Current Status
- **Backend URL**: http://172.210.115.60:8000
- **DNS**: http://fitfusion-api-gk.eastus.azurecontainer.io:8000
- **Issue**: No HTTPS support (required for iOS App Store, Service Workers, etc.)

## 🎯 Recommended Solution: Cloudflare Tunnel (FREE)

Cloudflare Tunnel provides free HTTPS without needing to buy a domain or SSL certificate.

### Benefits:
- ✅ **100% Free** - No cost for HTTPS
- ✅ **No custom domain required** - Get a free `.trycloudflare.com` subdomain
- ✅ **Automatic SSL** - Managed by Cloudflare
- ✅ **DDoS protection** - Built-in security
- ✅ **Easy setup** - 5 minute installation

### Setup Steps:

#### 1. Create Cloudflare Account (Free)
```bash
# Visit: https://dash.cloudflare.com/sign-up
# No credit card required
```

#### 2. Install Cloudflared in a Container
```bash
# Create a new container with cloudflared
docker run -d \
  --name fitfusion-tunnel \
  cloudflare/cloudflared:latest \
  tunnel --url http://172.210.115.60:8000 --no-autoupdate
```

#### 3. Get Your HTTPS URL
```bash
# Check the container logs for your HTTPS URL
docker logs fitfusion-tunnel | grep "trycloudflare.com"
# Example output: https://random-name-123.trycloudflare.com
```

#### 4. Deploy to Azure Container Instances
```yaml
# We can deploy cloudflared as a sidecar container
# This gives you a permanent HTTPS URL
```

---

## Alternative Options

### Option 2: Azure Application Gateway (~$150/month)

**Pros:**
- Native Azure solution
- Load balancing capabilities
- WAF (Web Application Firewall)

**Cons:**
- Expensive for small projects
- Complex setup

**Setup:**
```bash
# Create Application Gateway
az network application-gateway create \
  --name fitfusion-appgw \
  --resource-group fitfusion-docker-rg \
  --location eastus \
  --sku Standard_v2 \
  --capacity 1 \
  --vnet-name fitfusion-vnet \
  --subnet appgw-subnet \
  --public-ip-address fitfusion-appgw-ip \
  --http-settings-port 8000 \
  --http-settings-protocol Http
```

### Option 3: Custom Domain + Let's Encrypt (Domain cost only)

**Requirements:**
- Custom domain ($10-15/year)
- DNS configuration

**Setup:**
```bash
# 1. Buy a domain (e.g., fitfusion.com)
# 2. Point domain to: 172.210.115.60
# 3. Deploy nginx with certbot

docker run -d \
  --name nginx-ssl \
  -p 443:443 \
  -p 80:80 \
  -v letsencrypt:/etc/letsencrypt \
  -e DOMAIN=api.fitfusion.com \
  -e BACKEND=http://172.210.115.60:8000 \
  nginx-certbot
```

### Option 4: Self-Signed Certificate (Testing Only)

**Warning:** iOS will reject self-signed certificates in production

```bash
# Generate certificate
openssl req -x509 -newkey rsa:4096 \
  -keyout key.pem -out cert.pem \
  -days 365 -nodes \
  -subj "/CN=172.210.115.60"

# Deploy nginx with self-signed cert
# (Not recommended for production)
```

---

## 🚀 Quick Start: Cloudflare Tunnel Setup

### Step-by-Step:

1. **Install cloudflared locally** (for testing):
```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# Or download: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

2. **Create a tunnel** (quick test):
```bash
# This creates a temporary HTTPS URL
cloudflared tunnel --url http://172.210.115.60:8000
```

3. **Get your HTTPS URL** from the output:
```
Your quick Tunnel has been created! Visit it at:
https://random-words-123.trycloudflare.com
```

4. **Test it**:
```bash
curl https://random-words-123.trycloudflare.com/api/health
```

5. **Make it permanent** (recommended):
```bash
# Login to Cloudflare
cloudflared login

# Create a named tunnel
cloudflared tunnel create fitfusion-api

# Configure the tunnel
cat > config.yml << EOF
tunnel: fitfusion-api
credentials-file: ~/.cloudflared/[tunnel-id].json

ingress:
  - hostname: fitfusion-api.yourdomain.com
    service: http://172.210.115.60:8000
  - service: http_status:404
EOF

# Run the tunnel
cloudflared tunnel run fitfusion-api
```

---

## 📱 iOS App Considerations

For iOS App Store submission, you need:
- ✅ Valid HTTPS certificate
- ✅ TLS 1.2 or higher
- ✅ No self-signed certificates
- ✅ Proper CORS headers

**Cloudflare Tunnel meets all requirements!**

---

## 🔄 Next Steps After HTTPS Setup

1. Update frontend API URL:
```javascript
// frontend/src/config/api.js
PRODUCTION: {
  baseURL: 'https://your-tunnel-url.trycloudflare.com',
  apiPath: '/api'
}
```

2. Update backend CORS:
```bash
# Add HTTPS URL to CORS_ALLOWED_ORIGINS
az container create \
  --environment-variables \
    CORS_ALLOWED_ORIGINS='https://your-tunnel-url.trycloudflare.com,http://localhost:3000'
```

3. Rebuild and test:
```bash
cd frontend
npm run build
# Test with production build
```

4. Update iOS app:
```bash
npx cap sync ios
npx cap open ios
# Build in Release mode
```

---

## 💡 Recommendation

**Start with Cloudflare Tunnel:**
- Free and quick to set up
- Perfect for development and MVP
- Can upgrade to Application Gateway later if needed

**Command to get started:**
```bash
# Install cloudflared
brew install cloudflare/cloudflare/cloudflared

# Create tunnel
cloudflared tunnel --url http://172.210.115.60:8000
```

Then follow the HTTPS URL it provides!
