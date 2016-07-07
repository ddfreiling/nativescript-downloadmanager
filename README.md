# DownloadManager plugin for Nativescript

## Features
- Download files in the background using the platform's DownloadManager service on Android.
- Set local uri to save file to
- Option to set if download is allowed over a metered connection
- TODO: Use DownloadManager library with similar features on iOS

## Usage

Check the `demo` folder to see how the plugin is used. Look at DownloadJobManager in `demo` for advanced usage with Rxjs Observables.

### Development workflow:

1. Make changes to plugin files
2. Make changes in `demo` that would test those changes out
3. `npm run demo.ios` or `npm run demo.android`  **(must be run from the root directory)**
