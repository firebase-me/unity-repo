# 🔥 Firebase Unity Package Registry

A Unity Package Manager (UPM) compatible registry for Firebase Unity SDK packages, hosted on GitHub Pages.


## 📦 Installation

### Add Registry to Your Unity Project

1. Open your Unity project
2. Navigate to `Packages/manifest.json`
3. Add the scoped registry:

```json
{
  "scopedRegistries": [
    {
      "name": "Firebase Me",
      "url": "https://firebase-me.github.io/unity-repo",
      "scopes": ["com.google.firebase"]
    }
  ],
  "dependencies": {
    "com.google.firebase.analytics": "13.8.0",
    "com.google.firebase.auth": "10.5.0",
    "com.google.firebase.firestore": "13.8.0"
  }
}
```

**Choose ANY version** in dependencies - the registry serves all versions!

### Available Packages

| Package | Version | Description |
|---------|---------|-------------|
| `com.google.firebase.analytics` | 13.8.0 | Google Analytics |
| `com.google.firebase.app` | 13.8.0 | Firebase App Core |
| `com.google.firebase.app-check` | 13.8.0 | Firebase App Check |
| `com.google.firebase.auth` | 13.8.0 | Firebase Authentication |
| `com.google.firebase.crashlytics` | 13.8.0 | Firebase Crashlytics |
| `com.google.firebase.database` | 13.8.0 | Realtime Database |
| `com.google.firebase.firebaseai` | 13.8.0 | Firebase AI |
| `com.google.firebase.firestore` | 13.8.0 | Cloud Firestore |
| `com.google.firebase.functions` | 13.8.0 | Cloud Functions |
| `com.google.firebase.installations` | 13.8.0 | Firebase Installations |
| `com.google.firebase.messaging` | 13.8.0 | Cloud Messaging |
| `com.google.firebase.remote-config` | 13.8.0 | Remote Config |
| `com.google.firebase.storage` | 13.8.0 | Cloud Storage |

## 🌐 Registry URL

**Single registry for all versions:** `https://firebase-me.github.io/unity-repo`

### Package Downloads
Packages are served from version directories:
- `https://firebase-me.github.io/unity-repo/13/com.google.firebase.analytics-13.8.0.tgz`
- `https://firebase-me.github.io/unity-repo/10/com.google.firebase.auth-10.5.0.tgz`

The registry automatically routes to the correct version directory based on your dependency specification.

### Custom Domain (Future)
- `https://unity.firebase.me` (coming soon)

## 🚀 For Maintainers

### Building the Registry

```bash
node scripts/build-registry.js
```

This generates the registry metadata in `docs/unity/`.

### Publishing a Release

1. Tag the version:
   ```bash
   git tag v13.8.0
   git push origin v13.8.0
   ```

2. GitHub Actions will automatically:
   - Create a GitHub Release
   - Upload package tarballs
   - Rebuild the registry
   - Deploy to GitHub Pages

### Adding New Packages

1. Place `.tgz` files in `packages/`
2. Commit and push to `main`
3. GitHub Actions rebuilds the registry automatically

## 🏗️ Architecture

- **Storage**: GitHub Pages hosts package tarballs (.tgz files)
- **Registry**: GitHub Pages serves npm-compatible metadata (JSON)
- **Automation**: GitHub Actions handles CI/CD
- **Structure**: `/{version}/` for each major version (e.g., `/13/`)
- **Packages**: Served directly from `/{version}/<package>.tgz`

## 📚 Documentation

Visit the registry at: [https://firebase-me.github.io/unity-repo/unity](https://firebase-me.github.io/unity-repo/unity)

## 📄 License

Firebase packages are provided by Google under their respective licenses.
