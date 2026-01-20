# iOS Mobile App Deployment Guide

## Overview
Your FitFusion AI web application has been configured to run as a native iOS app using Capacitor.

## Prerequisites

### 1. Install Xcode
- Download and install [Xcode from the Mac App Store](https://apps.apple.com/us/app/xcode/id497799835)
- After installation, open Xcode and accept the license agreement
- Install Xcode Command Line Tools:
  ```bash
  xcode-select --install
  ```

### 2. Install CocoaPods
CocoaPods is required for managing iOS dependencies:
```bash
sudo gem install cocoapods
```

## Configuration Steps

### 1. Update Backend URL for Mobile
Since mobile apps can't use `localhost`, you need to update the API endpoints:

**Option A: Use your computer's local IP address (for development)**
- Find your Mac's IP address: `System Settings > Network` or run `ifconfig | grep "inet "`
- Update frontend API calls to use: `http://YOUR_IP_ADDRESS:5001`

**Option B: Deploy backend to a cloud server (for production)**
- Deploy your backend to a service like:
  - Heroku
  - AWS (EC2, Elastic Beanstalk)
  - Azure App Service
  - Google Cloud Platform
- Update all API URLs to use the deployed URL

### 2. Environment Configuration
Create a `.env` file in the `frontend` directory:
```env
REACT_APP_API_URL=http://YOUR_IP_OR_DOMAIN:5001
```

Then update your API calls to use `process.env.REACT_APP_API_URL` instead of hardcoded URLs.

## Building and Running the iOS App

### 1. Build the React App
```bash
cd frontend
npm run build
```

### 2. Sync with iOS Project
```bash
npx cap sync ios
```

### 3. Open in Xcode
```bash
npx cap open ios
```
Or use the npm script:
```bash
npm run ios:open
```

### 4. Run on Simulator or Device

#### In Xcode:
1. Select a target device/simulator from the top menu
2. Click the Play button (▶) or press `Cmd + R`

#### For Physical Device Testing:
1. Connect your iPhone via USB
2. In Xcode, select your device from the device dropdown
3. You may need to trust your computer on the iPhone
4. Enable Developer Mode on iOS 16+: `Settings > Privacy & Security > Developer Mode`
5. Sign the app with your Apple ID:
   - In Xcode, go to: `Signing & Capabilities`
   - Select your Team (your Apple ID)
   - Xcode will automatically create a provisioning profile

## App Store Submission (Production)

### 1. Enroll in Apple Developer Program
- Cost: $99/year
- Sign up at: https://developer.apple.com/programs/

### 2. Configure App Identity
Update `capacitor.config.ts`:
```typescript
const config: CapacitorConfig = {
  appId: 'com.yourcompany.fitfusionai',  // Change this to your unique bundle ID
  appName: 'FitFusion AI',
  webDir: 'build',
  server: {
    cleartext: true  // Remove this in production
  }
};
```

### 3. Prepare App Assets
Create required app icons and launch screens:
- App Icon: 1024x1024px
- Various sizes for different devices

Use a tool like [App Icon Generator](https://www.appicon.co/) or [Capacitor Assets](https://github.com/ionic-team/capacitor-assets)

### 4. Build for Release
1. In Xcode, select `Product > Archive`
2. Wait for the archive to complete
3. Click `Distribute App`
4. Follow the wizard to submit to App Store Connect
5. Fill in app metadata in App Store Connect
6. Submit for review

## Development Workflow

### Quick Development Cycle
```bash
# Make changes to your React code
# Then rebuild and sync:
npm run ios:build

# Or use this single command:
npm run ios:run
```

### Live Reload (Optional)
For faster development, you can enable live reload:
1. Make sure your backend is running
2. Update `capacitor.config.ts`:
```typescript
const config: CapacitorConfig = {
  appId: 'com.fitnessadvisor.app',
  appName: 'FitFusion AI',
  webDir: 'build',
  server: {
    url: 'http://YOUR_IP:3000',  // Your dev server
    cleartext: true
  }
};
```
3. Run `npx cap sync ios`
4. Now changes will reflect immediately without rebuilding

## Capacitor Plugins

Your app may benefit from these Capacitor plugins:

```bash
# Camera access (already using in web, but native is better)
npm install @capacitor/camera

# Geolocation
npm install @capacitor/geolocation

# Push Notifications
npm install @capacitor/push-notifications

# Storage (for offline data)
npm install @capacitor/preferences

# Status Bar customization
npm install @capacitor/status-bar
```

After installing plugins, run:
```bash
npx cap sync ios
```

## Troubleshooting

### CocoaPods Issues
```bash
cd ios/App
pod install
cd ../..
```

### Build Errors
- Clean build folder: In Xcode, `Product > Clean Build Folder`
- Delete derived data: `Xcode > Preferences > Locations > Derived Data > Delete`

### Network Issues
- Ensure your backend is accessible from the mobile device
- Check firewall settings
- For iOS 9+, you may need to configure App Transport Security (ATS) in Info.plist

### Camera/Permissions
Add required permissions to `ios/App/App/Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>We need camera access to analyze your fitness form</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>We need photo library access to select images</string>
```

## Project Structure

```
FitnessAdvisor-React-master/
├── frontend/
│   ├── ios/                    # Native iOS project
│   │   └── App/
│   │       └── App.xcodeproj   # Xcode project
│   ├── build/                  # Production build output
│   ├── capacitor.config.ts     # Capacitor configuration
│   └── package.json
├── backend/
│   └── app.py                  # Flask backend
└── IOS_DEPLOYMENT.md          # This file
```

## Next Steps

1. ✅ Install Xcode and CocoaPods
2. ✅ Configure your backend URL for mobile access
3. ✅ Build and test on iOS Simulator
4. ✅ Test on a physical device
5. ✅ Prepare app assets and metadata
6. ✅ Submit to App Store

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [iOS Deployment Guide](https://capacitorjs.com/docs/ios)
- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [App Store Connect](https://appstoreconnect.apple.com/)
