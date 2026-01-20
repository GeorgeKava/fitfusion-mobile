import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fitnessadvisor.app',
  appName: 'FitFusion AI',
  webDir: 'build',
  server: {
    // Allow loading from your local network during development
    // Change this to your backend IP address
    cleartext: true,
    androidScheme: 'https'
  },
  ios: {
    contentInset: 'always',
    // Handle safe area insets for notched devices
    allowsLinkPreview: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#007AFF",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#ffffff",
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#007AFF',
      overlaysWebView: false
    }
  }
};

export default config;
