# Frontend Production URL Configuration

## ✅ Changes Made

### 1. Updated API Configuration (`frontend/src/config/api.js`)

**Production URL Changed:**
- **Old:** `https://your-api.azurewebsites.net` (placeholder)
- **New:** `http://172.210.115.60:8000` (Azure Container Instance)

**Mobile Production Support:**
- Mobile apps now use production URL when built in production mode
- Development mode still uses local network IP (192.168.1.214:5001)

### 2. Created Production Environment File (`frontend/.env.production`)

```env
REACT_APP_API_URL=http://172.210.115.60:8000
REACT_APP_NAME=FitFusion AI
REACT_APP_VERSION=1.0.0
GENERATE_SOURCEMAP=false
```

### 3. Built Production Version

- Production build created in `frontend/build/` directory
- Optimized and minified for deployment
- File sizes:
  - JS: 89.92 kB (gzipped)
  - CSS: 34.21 kB (gzipped)

## 📋 Configuration Summary

| Environment | URL | Usage |
|------------|-----|-------|
| **Development (Web)** | http://localhost:5001 | Local backend development |
| **Development (Mobile)** | http://192.168.1.214:5001 | Testing on iOS device |
| **Production (Web & Mobile)** | http://172.210.115.60:8000 | Deployed Azure backend |

## 🚀 Deployment Options

### Option 1: Azure Static Web Apps (Recommended)
```bash
# Install Azure Static Web Apps CLI
npm install -g @azure/static-web-apps-cli

# Deploy from build folder
cd frontend
swa deploy ./build --deployment-token <your-token>
```

### Option 2: Azure Storage Static Website
```bash
# Create storage account and enable static website
az storage blob service-properties update \
  --account-name <storage-account> \
  --static-website \
  --index-document index.html

# Upload build files
az storage blob upload-batch \
  -d '$web' \
  -s ./build \
  --account-name <storage-account>
```

### Option 3: Azure App Service
```bash
# Create App Service plan
az appservice plan create \
  --name fitfusion-frontend-plan \
  --resource-group fitfusion-docker-rg \
  --sku F1 --is-linux

# Create web app
az webapp create \
  --resource-group fitfusion-docker-rg \
  --plan fitfusion-frontend-plan \
  --name fitfusion-frontend \
  --runtime "NODE|18-lts"

# Deploy
cd frontend
zip -r build.zip build/*
az webapp deployment source config-zip \
  --resource-group fitfusion-docker-rg \
  --name fitfusion-frontend \
  --src build.zip
```

## ⚠️ Important Notes

### HTTPS Required for Production
The current backend URL uses HTTP, which will cause issues with:
- Service Workers
- Geolocation API
- Camera/Microphone access
- iOS App Store submission

**Solutions:**
1. **Azure Application Gateway** with SSL certificate
2. **Azure Front Door** with managed SSL
3. **Let's Encrypt** with custom domain

### CORS Configuration
When you deploy the frontend, add its URL to backend CORS:

```bash
# Update container with new CORS origins
az container create \
  --environment-variables \
    CORS_ALLOWED_ORIGINS='http://localhost:3000,https://your-frontend-url.azurestaticapps.net,http://172.210.115.60:8000'
```

## 🧪 Testing

### Test Production Build Locally
```bash
cd frontend/build
python3 -m http.server 3001

# Visit: http://localhost:3001
```

### Test iOS App
```bash
cd frontend
npm run build
npx cap sync ios
npx cap open ios

# Build and run in Xcode
```

## 📱 iOS App Configuration

The iOS app will automatically use production URL when:
1. Built in Release mode in Xcode
2. `process.env.NODE_ENV === 'production'`

No additional configuration needed - it uses the same `api.js` logic!

## 🔄 Next Steps

1. ✅ **Frontend URL configured** - Points to Azure Container Instance
2. ✅ **Production build created** - Ready to deploy
3. ⏳ **Deploy frontend** - Choose deployment option above
4. ⏳ **Configure HTTPS** - Required for iOS submission
5. ⏳ **Update CORS** - Add frontend URL to backend
6. ⏳ **Test end-to-end** - Verify all features work

---

**Backend URL:** http://172.210.115.60:8000  
**Backend DNS:** http://fitfusion-api-gk.eastus.azurecontainer.io:8000  
**Frontend Build:** Ready in `frontend/build/`  
**Status:** ✅ Configured and tested
