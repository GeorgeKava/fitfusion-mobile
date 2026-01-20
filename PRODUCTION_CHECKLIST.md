# Production Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. Security Configuration
- [ ] **Generate New JWT Secret Key**
  ```bash
  python3 -c "import secrets; print(secrets.token_urlsafe(32))"
  ```
  - [ ] Update `JWT_SECRET_KEY` in production environment
  - [ ] Never commit the secret to version control
  - [ ] Store in environment variable or secure secret manager

- [ ] **Configure CORS**
  - [ ] Set `CORS_ALLOWED_ORIGINS` to production domains only
  - [ ] Remove `*` wildcard if present
  - [ ] Example: `https://yourapp.com,https://api.yourapp.com`

- [ ] **Flask Debug Mode**
  - [ ] Set `FLASK_DEBUG="false"` in production
  - [ ] Verify no debug endpoints are exposed

- [ ] **Session Security**
  - [ ] `SESSION_COOKIE_SECURE=True` (HTTPS only)
  - [ ] `SESSION_COOKIE_HTTPONLY=True` (no JavaScript access)
  - [ ] `SESSION_COOKIE_SAMESITE='Lax'` (CSRF protection)

### 2. Code Review
- [ ] **Remove Development Code**
  - [ ] Remove all `console.log()` statements from frontend
  - [ ] Remove `print()` debugging statements from backend
  - [ ] Remove test endpoints or protect with authentication

- [ ] **Authentication Coverage**
  - [ ] All API endpoints have `@require_auth` decorator (except login/register)
  - [ ] Verified: fitness_recommendation ✅
  - [ ] Verified: get-weekly-plan ✅
  - [ ] Verified: generate-weekly-plan ✅
  - [ ] Verified: food_recommendations ✅
  - [ ] Verified: identify_food ✅
  - [ ] Verified: get-user-profile ✅
  - [ ] Verified: delete-account ✅
  - [ ] Verified: search-users ✅
  - [ ] Verified: vector-store/stats ✅
  - [ ] Verified: vector-store/test ✅
  - [ ] Verified: list-all-users ✅

- [ ] **Input Validation**
  - [ ] All user inputs validated with InputValidator
  - [ ] File uploads restricted to allowed types
  - [ ] File size limits enforced (10MB max)
  - [ ] SQL injection prevention verified
  - [ ] XSS prevention verified

### 3. Infrastructure Setup

#### Option A: Azure App Service (Recommended)
- [ ] **Create Azure Resources**
  ```bash
  # Login to Azure
  az login
  
  # Create resource group
  az group create --name fitfusion-rg --location eastus
  
  # Create App Service plan
  az appservice plan create --name fitfusion-plan --resource-group fitfusion-rg --sku B1 --is-linux
  
  # Create web app
  az webapp create --name fitfusion-api --resource-group fitfusion-rg --plan fitfusion-plan --runtime "PYTHON:3.9"
  ```

- [ ] **Configure Environment Variables**
  ```bash
  az webapp config appsettings set --name fitfusion-api --resource-group fitfusion-rg --settings \
    FLASK_DEBUG="false" \
    JWT_SECRET_KEY="<your-new-secret>" \
    CORS_ALLOWED_ORIGINS="https://yourapp.com" \
    OPENAI_API_KEY="<your-openai-key>" \
    AZURE_API_KEY="<your-azure-key>" \
    AZURE_ENDPOINT="<your-azure-endpoint>"
  ```

- [ ] **Enable HTTPS Only**
  ```bash
  az webapp update --name fitfusion-api --resource-group fitfusion-rg --https-only true
  ```

- [ ] **Deploy Application**
  ```bash
  cd backend
  az webapp up --name fitfusion-api --resource-group fitfusion-rg --runtime "PYTHON:3.9"
  ```

- [ ] **Verify Deployment**
  - [ ] Visit: `https://fitfusion-api.azurewebsites.net`
  - [ ] Check SSL certificate is valid
  - [ ] Test health endpoint

#### Option B: Nginx + Let's Encrypt (Self-Hosted)
- [ ] **Install Dependencies**
  ```bash
  sudo apt update
  sudo apt install nginx certbot python3-certbot-nginx
  ```

- [ ] **Configure Nginx**
  - [ ] Copy nginx configuration from HTTPS_PRODUCTION_SETUP.md
  - [ ] Update server_name with your domain
  - [ ] Test configuration: `sudo nginx -t`
  - [ ] Reload: `sudo systemctl reload nginx`

- [ ] **Obtain SSL Certificate**
  ```bash
  sudo certbot --nginx -d api.yourdomain.com
  ```

- [ ] **Start Gunicorn**
  ```bash
  cd backend
  source venv/bin/activate
  gunicorn -c gunicorn.conf.py app:app
  ```

- [ ] **Setup Systemd Service** (for auto-start)
  - [ ] Create service file: `/etc/systemd/system/fitfusion-api.service`
  - [ ] Enable service: `sudo systemctl enable fitfusion-api`
  - [ ] Start service: `sudo systemctl start fitfusion-api`

#### Option C: Docker + Traefik
- [ ] **Create Dockerfile**
  - [ ] Based on python:3.9-slim
  - [ ] Copy requirements and install dependencies
  - [ ] Copy application code
  - [ ] Expose port 5001

- [ ] **Configure docker-compose.yml**
  - [ ] Traefik service with Let's Encrypt
  - [ ] Backend service with labels
  - [ ] Environment variables from .env

- [ ] **Deploy**
  ```bash
  docker-compose up -d
  ```

### 4. Frontend Configuration
- [ ] **Update API URL**
  - [ ] Set `REACT_APP_API_URL` to production backend URL
  - [ ] Example: `https://fitfusion-api.azurewebsites.net`

- [ ] **Build Production Bundle**
  ```bash
  cd frontend
  npm run build
  ```

- [ ] **Deploy Frontend**
  - [ ] Azure Static Web Apps: `az staticwebapp create`
  - [ ] Netlify: `netlify deploy --prod`
  - [ ] Vercel: `vercel --prod`
  - [ ] GitHub Pages: Push to gh-pages branch

- [ ] **Update iOS Capacitor Config**
  ```typescript
  {
    "server": {
      "url": "https://your-production-url.com",
      "cleartext": false,
      "androidScheme": "https"
    }
  }
  ```

### 5. Database & Storage
- [ ] **Backup ChromaDB**
  ```bash
  tar -czf chroma_db_backup_$(date +%Y%m%d).tar.gz chroma_db/
  ```

- [ ] **Configure Persistent Storage**
  - [ ] Azure: Mount Azure Files for chroma_db
  - [ ] AWS: Mount EBS volume
  - [ ] Self-hosted: Ensure proper backup strategy

- [ ] **Test Database Connectivity**
  - [ ] Create test user in production
  - [ ] Verify user persists after restart
  - [ ] Delete test user

### 6. Monitoring & Logging
- [ ] **Application Insights (Azure)**
  ```bash
  az monitor app-insights component create \
    --app fitfusion-insights \
    --location eastus \
    --resource-group fitfusion-rg
  ```

- [ ] **Configure Logging**
  - [ ] Set up log aggregation (Azure Monitor, CloudWatch, ELK)
  - [ ] Configure log levels (INFO for production)
  - [ ] Set up alerts for errors

- [ ] **Performance Monitoring**
  - [ ] Enable APM (Application Performance Monitoring)
  - [ ] Set up uptime monitoring
  - [ ] Configure alerts for downtime

### 7. Testing in Production
- [ ] **Authentication Flow**
  - [ ] Register new user over HTTPS
  - [ ] Login and receive JWT token
  - [ ] Verify token stored in localStorage
  - [ ] Logout and verify token removed

- [ ] **API Endpoints**
  - [ ] Test fitness recommendations
  - [ ] Test weekly plan generation
  - [ ] Test food recommendations
  - [ ] Test food image identification
  - [ ] Test profile update
  - [ ] Test account deletion

- [ ] **Error Handling**
  - [ ] Test with invalid inputs
  - [ ] Test with expired JWT token
  - [ ] Test with missing authentication
  - [ ] Verify appropriate error messages

- [ ] **Performance**
  - [ ] Test with multiple concurrent users
  - [ ] Verify response times < 3s for AI endpoints
  - [ ] Check memory usage under load
  - [ ] Monitor CPU usage

### 8. Security Validation
- [ ] **SSL/TLS Configuration**
  - [ ] Test with: https://www.ssllabs.com/ssltest/
  - [ ] Verify grade A or A+
  - [ ] Check certificate expiration date

- [ ] **Security Headers**
  - [ ] Test with: https://securityheaders.com/
  - [ ] Verify HSTS enabled
  - [ ] Verify X-Content-Type-Options: nosniff
  - [ ] Verify X-Frame-Options: DENY

- [ ] **Penetration Testing**
  - [ ] Run OWASP ZAP scan
  - [ ] Test for SQL injection
  - [ ] Test for XSS vulnerabilities
  - [ ] Test for CSRF vulnerabilities

- [ ] **Rate Limiting**
  - [ ] Verify 5 requests/min on login endpoint
  - [ ] Verify 200 requests/day global limit
  - [ ] Test rate limit responses (429)

### 9. Documentation
- [ ] **Update README.md**
  - [ ] Add production deployment instructions
  - [ ] Document environment variables
  - [ ] Add troubleshooting section

- [ ] **API Documentation**
  - [ ] Document all endpoints
  - [ ] Include authentication requirements
  - [ ] Provide example requests/responses

- [ ] **Runbook**
  - [ ] Document deployment process
  - [ ] Document rollback procedure
  - [ ] Document incident response

### 10. Post-Deployment
- [ ] **Announcement**
  - [ ] Notify users of new production URL
  - [ ] Update app store listings (iOS/Android)
  - [ ] Update social media links

- [ ] **Monitoring Setup**
  - [ ] Set up error tracking (Sentry, Rollbar)
  - [ ] Configure uptime monitoring (UptimeRobot, Pingdom)
  - [ ] Set up performance tracking (New Relic, DataDog)

- [ ] **Backup Strategy**
  - [ ] Schedule daily database backups
  - [ ] Test backup restoration
  - [ ] Document backup locations

- [ ] **Incident Response**
  - [ ] Document on-call rotation
  - [ ] Create incident response playbook
  - [ ] Set up alerting channels (PagerDuty, Slack)

---

## 🚨 Quick Commands Reference

### Generate JWT Secret
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Test Gunicorn Locally
```bash
cd backend
source venv/bin/activate
export FLASK_DEBUG="false"
gunicorn -c gunicorn.conf.py app:app
```

### Deploy to Azure (Quick)
```bash
cd backend
az webapp up --name fitfusion-api --runtime "PYTHON:3.9"
```

### Check Production Logs (Azure)
```bash
az webapp log tail --name fitfusion-api --resource-group fitfusion-rg
```

### Test HTTPS Endpoint
```bash
curl -I https://fitfusion-api.azurewebsites.net
```

### Test Authentication
```bash
# Register
curl -X POST https://your-api.com/create-user-profile \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test User","age":25,"weight":70,"height":175,"gender":"male","agent_type":"general"}'

# Login
curl -X POST https://your-api.com/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

---

## 📞 Support & Resources

- **HTTPS Setup Guide**: See `HTTPS_PRODUCTION_SETUP.md`
- **iOS Deployment**: See `IOS_DEPLOYMENT.md`
- **Security Audit**: Review all items marked with 🔒

**Deployment Status**: Ready for production deployment! ✅
