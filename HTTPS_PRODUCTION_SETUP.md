# HTTPS Production Setup Guide

## Overview
HTTPS is critical for production to encrypt data in transit, especially JWT tokens and passwords.

## Option 1: Deploy with Cloud Platform (Recommended)

### Azure App Service (Automatic HTTPS)
Azure App Service provides automatic HTTPS with free SSL certificates.

**Deployment Steps:**
1. Create Azure App Service
2. Deploy your Flask app
3. Azure automatically provisions SSL certificate
4. Your app is available at `https://your-app.azurewebsites.net`

**Backend Configuration:**
```python
# app.py - No changes needed!
# Azure handles SSL termination at the load balancer
if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
```

**Frontend Configuration:**
```javascript
// frontend/src/config/api.js
const API_CONFIG = {
  PRODUCTION: {
    baseURL: 'https://your-app.azurewebsites.net',
    apiPath: '/api'
  }
};
```

### Heroku (Automatic HTTPS)
Similar to Azure, Heroku provides automatic HTTPS.

### AWS Elastic Beanstalk / EC2 + ALB
Use Application Load Balancer with AWS Certificate Manager (free SSL).

## Option 2: Self-Hosted with Nginx + Let's Encrypt

If you deploy to your own server (DigitalOcean, Linode, etc.):

### 1. Install Nginx
```bash
sudo apt update
sudo apt install nginx
```

### 2. Install Certbot (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
```

### 3. Configure Nginx as Reverse Proxy
```nginx
# /etc/nginx/sites-available/fitfusion
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration (Certbot will add these)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4. Get SSL Certificate
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 5. Auto-Renewal
Certbot automatically sets up renewal. Test it:
```bash
sudo certbot renew --dry-run
```

### 6. Run Flask with Gunicorn (Production WSGI Server)
```bash
pip install gunicorn

# Run with 4 workers
gunicorn --workers 4 --bind 127.0.0.1:5001 app:app
```

## Option 3: Docker + Traefik (Advanced)

For containerized deployments with automatic HTTPS:

```yaml
# docker-compose.yml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    command:
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.email=your@email.com"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./letsencrypt:/letsencrypt

  backend:
    build: ./backend
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`yourdomain.com`)"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
```

## Required Code Changes

### 1. Update Environment Variables

**backend/.env (Production)**
```bash
# Flask Configuration
FLASK_DEBUG="false"  # CRITICAL: Disable debug in production!
FLASK_HOST="0.0.0.0"
FLASK_PORT="5001"

# CORS Configuration (Add your production domain)
CORS_ALLOWED_ORIGINS="https://yourdomain.com,https://www.yourdomain.com,https://api.yourdomain.com,capacitor://localhost,ionic://localhost"

# JWT Configuration
JWT_SECRET_KEY="YOUR_NEW_PRODUCTION_SECRET_KEY_HERE"  # Generate new key!
```

### 2. Generate New JWT Secret Key

**Run this to generate a secure key:**
```python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 3. Update Frontend API Configuration

**frontend/src/config/api.js**
```javascript
const API_CONFIG = {
  // Development configuration
  DEV: {
    baseURL: 'http://localhost:5001',
    apiPath: '/api'
  },
  
  // Mobile/Local network testing
  MOBILE: {
    baseURL: 'http://192.168.1.214:5001',
    apiPath: '/api'
  },
  
  // Production configuration
  PRODUCTION: {
    baseURL: 'https://api.yourdomain.com',  // Your production domain
    apiPath: '/api'
  }
};

const isMobile = () => {
  return window.Capacitor !== undefined;
};

const getConfig = () => {
  // Check if in production
  if (process.env.NODE_ENV === 'production') {
    return API_CONFIG.PRODUCTION;
  }
  
  // Mobile development
  if (isMobile()) {
    return API_CONFIG.MOBILE;
  }
  
  // Local development
  return API_CONFIG.DEV;
};

export const API_BASE_URL = getConfig().baseURL;
export const API_PATH = getConfig().apiPath;
export const getApiUrl = (endpoint) => `${API_BASE_URL}${API_PATH}${endpoint}`;
```

## iOS App Configuration

For iOS production, update the Capacitor configuration:

**frontend/capacitor.config.ts**
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fitfusion.app',
  appName: 'FitFusion AI',
  webDir: 'build',
  server: {
    // Production API
    url: 'https://api.yourdomain.com',
    cleartext: false,  // Force HTTPS
  },
  ios: {
    contentInset: 'always'
  }
};

export default config;
```

## Security Checklist for Production

### ✅ Before Deploying:

- [ ] Set `FLASK_DEBUG="false"` in production .env
- [ ] Generate and set new `JWT_SECRET_KEY`
- [ ] Update `CORS_ALLOWED_ORIGINS` with production domains
- [ ] Enable HTTPS (via cloud platform or Nginx + Let's Encrypt)
- [ ] Use production WSGI server (Gunicorn, not Flask dev server)
- [ ] Set secure session cookies: `SESSION_COOKIE_SECURE = True`
- [ ] Enable HSTS header (Strict-Transport-Security)
- [ ] Remove any console.log statements with sensitive data
- [ ] Verify all API endpoints use `@require_auth`
- [ ] Test input validation on all forms
- [ ] Set up monitoring and logging (Azure Monitor, DataDog, etc.)
- [ ] Create backup strategy for ChromaDB
- [ ] Set up rate limiting for production traffic
- [ ] Review and remove any test/debug endpoints

## Testing HTTPS Locally (Optional)

If you want to test HTTPS during development:

### 1. Generate Self-Signed Certificate
```bash
cd backend
mkdir ssl
openssl req -x509 -newkey rsa:4096 -nodes \
  -out ssl/cert.pem \
  -keyout ssl/key.pem \
  -days 365 \
  -subj "/CN=localhost"
```

### 2. Run Flask with SSL
```python
# app.py
if __name__ == '__main__':
    if os.getenv('FLASK_ENV') == 'development':
        # Development with HTTPS
        app.run(
            host='0.0.0.0',
            port=5001,
            debug=True,
            ssl_context=('ssl/cert.pem', 'ssl/key.pem')
        )
    else:
        # Production (Gunicorn handles SSL via Nginx)
        app.run(host='0.0.0.0', port=5001, debug=False)
```

### 3. Update Frontend for Local HTTPS
```javascript
// frontend/src/config/api.js
DEV: {
  baseURL: 'https://localhost:5001',  // Note: HTTPS
  apiPath: '/api'
}
```

**Note:** Browsers will show security warning for self-signed certificates. This is normal for local development.

## Deployment Recommendations

### Best Option for Quick Deployment: **Azure App Service**

**Advantages:**
- Automatic HTTPS with free SSL certificate
- Easy deployment (Git push or GitHub Actions)
- Managed infrastructure
- Built-in scaling
- Azure integration for monitoring

**Quick Deploy:**
```bash
# Install Azure CLI
brew install azure-cli  # macOS

# Login
az login

# Create App Service
az webapp up --name fitfusion-api --runtime "PYTHON:3.9"

# Your app is now live at https://fitfusion-api.azurewebsites.net
```

## iOS App Store Submission

When submitting to App Store, Apple requires:
- All HTTP traffic must use HTTPS (enforced by iOS)
- Valid SSL certificate (not self-signed)
- App Transport Security (ATS) compliance

Your app is already configured for this with HTTPS production URLs.

---

**Next Steps:**
1. Choose deployment option (Azure recommended)
2. Deploy backend with HTTPS
3. Update frontend API config with production URL
4. Generate new JWT secret key
5. Set `FLASK_DEBUG="false"`
6. Test authentication flow over HTTPS
7. Submit iOS app to App Store

**Status:** Configuration ready, awaiting deployment platform decision
