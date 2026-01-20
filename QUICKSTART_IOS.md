# Quick Start Guide - iOS Mobile App

## ✅ API Configuration Complete!

Your app has been configured to work on iOS devices. All API endpoints now automatically detect whether the app is running on mobile or web:

- **Web (localhost)**: Uses `http://localhost:5001`
- **Mobile**: Uses `http://192.168.1.214:5001` (your Mac's local IP)

## 🚀 Running the iOS App

### Step 1: Make Sure Backend is Running

```bash
# In a terminal, navigate to backend and start the server
cd backend
python app.py
```

The backend should be running on: `http://192.168.1.214:5001`

### Step 2: Open the iOS Project in Xcode

```bash
cd frontend
npm run ios:open
```

Or manually:
```bash
cd frontend
npx cap open ios
```

### Step 3: Run on Simulator or Device

**In Xcode:**
1. Select a target device/simulator from the top toolbar
   - For simulator: Choose "iPhone 15 Pro" or any available simulator
   - For real device: Connect your iPhone via USB and select it
2. Click the Play button (▶) or press `Cmd + R`
3. Wait for the app to build and launch

### Step 4: Test the Connection

Once the app launches:
1. Try logging in or registering
2. Upload fitness photos and get recommendations
3. All features should work just like the web version!

## 📱 Running on a Physical iPhone

1. **Connect your iPhone** via USB to your Mac
2. **Trust your computer** on the iPhone (if prompted)
3. **Enable Developer Mode** (iOS 16+):
   - Go to: `Settings > Privacy & Security > Developer Mode`
   - Toggle it ON and restart your iPhone
4. **In Xcode**, select your iPhone from the device dropdown
5. **Sign the app** with your Apple ID:
   - In Xcode, select the project in the left sidebar
   - Click on "Signing & Capabilities" tab
   - Check "Automatically manage signing"
   - Select your Team (your Apple ID)
6. Click the Play button (▶) to build and run on your device

## 🔧 Troubleshooting

### "App couldn't connect to backend"
- Make sure your iPhone/simulator is on the **same WiFi network** as your Mac
- Check that the backend is running: `http://192.168.1.214:5001`
- Test the connection in Safari on your iPhone: navigate to `http://192.168.1.214:5001/api/health-check`

### "Development server at localhost:5001 is not reachable"
- This is normal! Mobile devices can't access `localhost`
- The app is configured to use `192.168.1.214:5001` instead
- If you see this, make sure you've rebuilt: `npm run build && npx cap sync ios`

### Camera not working
Add camera permissions to `ios/App/App/Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>We need camera access to analyze your fitness form</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>We need photo library access to select images</string>
```

### Build errors in Xcode
1. Clean build folder: `Product > Clean Build Folder` (Shift + Cmd + K)
2. Close and reopen Xcode
3. Try: `cd frontend/ios/App && pod install` (if CocoaPods is installed)

## 🔄 Making Changes

After making changes to your React code:

```bash
cd frontend
npm run ios:build  # Builds and syncs to iOS
```

Then in Xcode, just click Run again (Cmd + R)

## 🌐 Changing the Backend URL

If your Mac's IP address changes, or you want to deploy to a cloud server:

1. Edit `frontend/src/config/api.js`
2. Update the `MOBILE.baseURL` value:
   ```javascript
   MOBILE: {
     baseURL: 'http://YOUR_NEW_IP_OR_DOMAIN:5001',
     apiPath: '/api'
   }
   ```
3. Rebuild and sync:
   ```bash
   npm run ios:build
   ```

## 📊 Network Debugging

To see API calls in the iOS app:
- In Xcode, open the Debug Console (View > Debug Area > Activate Console)
- Look for `[API GET]` or `[API POST]` log messages
- These show which endpoints are being called

## Next Steps

- ✅ Test all features (login, recommendations, voice chat, etc.)
- ✅ Deploy backend to cloud for production use
- ✅ Add app icon and splash screen
- ✅ Submit to App Store when ready

Need help? Check `IOS_DEPLOYMENT.md` for complete documentation!
