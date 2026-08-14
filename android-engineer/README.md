# Limewood Engineer Android

Native Android shell for the deployed Limewood Engineer interface.

## Production URL
`https://limewood-engineering.pro/engineer/`

Normal Engineer App HTML/CSS/JS updates continue to deploy through the website and appear in this Android app automatically. Rebuild the Android app only when native shell behaviour changes.

## Build
1. Open this folder in Android Studio.
2. Install Android SDK 36 / Build Tools 36.0.0 if prompted.
3. Let Gradle sync.
4. Build > Build APK(s) for a test APK.
5. For distribution, create a signed release APK/AAB using Android Studio's Generate Signed App Bundle or APK flow.

Package: `uk.co.limewood.engineer`
Version: `1.0.0` (1)
Minimum Android: 8.0 (API 26)
Target Android: 16 (API 36)

## Behaviour
- Full-screen app window with no browser address bar.
- Loads the live `/engineer/` interface so normal web deployments update automatically.
- Supabase login/local storage persists inside Android WebView.
- Job photo file input opens the Android system file/camera chooser.
- Links outside `limewood-engineering.pro` open in the device browser. This includes BMS/local-network links.
- Android Back navigates inside the Engineer App before closing.
- Offline screen includes a Retry action.

## Important
The existing website remains the source of truth for the Engineer UI. This Android project is the native container, not a second copy of the maintenance database.
