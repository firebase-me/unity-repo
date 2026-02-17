# Package Storage

Store Firebase Unity SDK packages organized by major version.

## Directory Structure

```
packages/
├── 10/          # Firebase SDK v10.x.x
├── 11/          # Firebase SDK v11.x.x
├── 12/          # Firebase SDK v12.x.x
└── 13/          # Firebase SDK v13.x.x
    ├── com.google.firebase.analytics-13.8.0.tgz
    ├── com.google.firebase.auth-13.8.0.tgz
    └── ...
```

## Adding Packages

1. **Determine major version:** Extract from package version (e.g., `13.8.0` → major version `13`)
2. **Place in correct directory:** Copy `.tgz` files to `packages/{major}/`
3. **Commit and push:** The build script will automatically detect and process them

## File Naming Convention

Packages must follow this format:
```
com.google.firebase.{service}-{version}.tgz
```

Examples:
- `com.google.firebase.analytics-13.8.0.tgz`
- `com.google.firebase.auth-10.5.0.tgz`
- `com.google.firebase.firestore-12.3.1.tgz`

## Latest Version Strategy

- Only keep the **latest minor/patch version** for each major version
- Example: If you have `13.7.0` and add `13.8.0`, remove `13.7.0`
- Users automatically get the latest when they request the major version

## Adding New Major Version

1. Create directory: `packages/{version}/`
2. Add `.tgz` files
3. Build script automatically detects and includes in registry
