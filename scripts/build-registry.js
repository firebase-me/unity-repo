const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');
const https = require('https');

// Parse command line args
const REMOTE_MODE = process.argv.includes('--remote');

function computeHashes(data) {
  const shasum = crypto.createHash('sha1').update(data).digest('hex');
  const integrity = `sha512-${crypto.createHash('sha512').update(data).digest('base64')}`;
  return { shasum, integrity };
}

function computeHashesFromFile(filePath) {
  const data = fs.readFileSync(filePath);
  return computeHashes(data);
}

async function fetchRemoteFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchRemoteFile(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function computeHashesRemote(url) {
  const data = await fetchRemoteFile(url);
  return computeHashes(data);
}

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');
const OUTPUT_DIR = path.join(__dirname, '..', 'docs');
const REPO_URL = 'https://github.com/firebase-me/unity-repo';
const BASE_URL = 'https://firebase-me.github.io/unity-repo';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
// Disable Jekyll processing on GitHub Pages
fs.writeFileSync(path.join(OUTPUT_DIR, '.nojekyll'), '');

console.log('Building Unity Package Registry...\n');

// Get all major version directories
const majorVersions = fs.readdirSync(PACKAGES_DIR)
  .filter(f => {
    const fullPath = path.join(PACKAGES_DIR, f);
    return fs.statSync(fullPath).isDirectory() && /^\d+$/.test(f);
  })
  .sort((a, b) => parseInt(b) - parseInt(a)); // Sort descending

console.log(`Found major versions: ${majorVersions.join(', ')}\n`);

const allRegistries = {};

// Process each major version
majorVersions.forEach(majorVersion => {
  console.log(`\n📦 Processing Major Version ${majorVersion}`);
  console.log('='.repeat(50));
  
  const majorVersionDir = path.join(PACKAGES_DIR, majorVersion);
  const tgzFiles = fs.readdirSync(majorVersionDir).filter(f => f.endsWith('.tgz'));
  
  console.log(`Found ${tgzFiles.length} packages\n`);
  
  const registry = {};
  
  tgzFiles.forEach(tgzFile => {
    console.log(`  Processing: ${tgzFile}`);
    
    const tgzPath = path.join(majorVersionDir, tgzFile);
    const tempDir = path.join(__dirname, 'temp', path.basename(tgzFile, '.tgz'));
    
    // Clean temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Extract package.json from tarball
    try {
      execSync(`tar -xzf "${tgzPath}" -C "${tempDir}"`, { stdio: 'ignore' });
      
      const packageJsonPath = path.join(tempDir, 'package', 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        console.error(`    ❌ No package.json found in ${tgzFile}`);
        return;
      }
      
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const { name, version, displayName, description, unity, dependencies } = packageJson;
      
      console.log(`    ✓ ${name}@${version}`);
      
      // Initialize package registry entry
      if (!registry[name]) {
        registry[name] = {
          name,
          versions: {},
          'dist-tags': { latest: version }
        };
      }
      
      // Add version entry
      const { shasum, integrity } = computeHashes(tgzPath);
      const isEdm = name === 'com.google.external-dependency-manager';
      const tarballUrl = `${BASE_URL}/${majorVersion}/${tgzFile}${isEdm ? '?v=2' : ''}`;
      registry[name].versions[version] = {
        name,
        version,
        displayName,
        description: description || '',
        unity: unity || '2020.1',
        dependencies: dependencies || {},
        dist: {
          tarball: tarballUrl,
          shasum,
          integrity
        }
      };
      
      // Update latest version
      const versions = Object.keys(registry[name].versions).sort((a, b) => {
        const aParts = a.split('.').map(Number);
        const bParts = b.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
          if (aParts[i] !== bParts[i]) return bParts[i] - aParts[i];
        }
        return 0;
      });
      registry[name]['dist-tags'].latest = versions[0];
      
    } catch (error) {
      console.error(`    ❌ Error processing ${tgzFile}:`, error.message);
    } finally {
      // Cleanup temp directory
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
    }
  });
  
  // Store registry for this major version
  allRegistries[majorVersion] = registry;
  
  // Copy .tgz files to output directory
  console.log(`\n  Copying packages...`);
  const versionOutputDir = path.join(OUTPUT_DIR, majorVersion);
  if (!fs.existsSync(versionOutputDir)) {
    fs.mkdirSync(versionOutputDir, { recursive: true });
  }
  
  tgzFiles.forEach(tgzFile => {
    const srcPath = path.join(majorVersionDir, tgzFile);
    const destPath = path.join(versionOutputDir, tgzFile);
    fs.copyFileSync(srcPath, destPath);
    console.log(`    ✓ ${tgzFile}`);
  });
});

// Clean up temp directory
const tempBaseDir = path.join(__dirname, 'temp');
if (fs.existsSync(tempBaseDir)) {
  fs.rmSync(tempBaseDir, { recursive: true });
}

console.log('\n\n📦 Generating Registry Metadata');
console.log('='.repeat(50));

// Merge all versions into a single root registry
const rootRegistry = {};

majorVersions.forEach(majorVersion => {
  const registry = allRegistries[majorVersion];
  
  Object.keys(registry).forEach(packageName => {
    if (!rootRegistry[packageName]) {
      rootRegistry[packageName] = {
        name: packageName,
        versions: {},
        'dist-tags': { latest: '' }
      };
    }
    
    // Merge versions from this major version
    Object.assign(rootRegistry[packageName].versions, registry[packageName].versions);
  });
});

// Update latest tags for each package
Object.keys(rootRegistry).forEach(packageName => {
  const versions = Object.keys(rootRegistry[packageName].versions).sort((a, b) => {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if (aParts[i] !== bParts[i]) return bParts[i] - aParts[i];
    }
    return 0;
  });
  rootRegistry[packageName]['dist-tags'].latest = versions[0];
});

console.log('\nWriting root registry metadata...');

// Write individual package metadata files (npm-style)
Object.keys(rootRegistry).forEach(packageName => {
  const packageData = rootRegistry[packageName];
  const json = JSON.stringify(packageData, null, 2);
  
  // npm-style: GET /<packageName> should return JSON
  const pkgPath = path.join(OUTPUT_DIR, packageName);
  if (fs.existsSync(pkgPath) && fs.statSync(pkgPath).isDirectory()) {
    fs.rmSync(pkgPath, { recursive: true, force: true });
  }
  fs.writeFileSync(pkgPath, json);
  
  // Also write .json for debugging
  const pkgJsonPath = path.join(OUTPUT_DIR, `${packageName}.json`);
  if (fs.existsSync(pkgJsonPath) && fs.statSync(pkgJsonPath).isDirectory()) {
    fs.rmSync(pkgJsonPath, { recursive: true, force: true });
  }
  fs.writeFileSync(pkgJsonPath, json);
  
  console.log(`  ✓ ${packageName}`);
});

// Write root registry index
const registryIndex = {
  name: 'Firebase Unity Packages',
  version: '1.0.0',
  packages: Object.keys(rootRegistry).map(name => ({
    name,
    versions: Object.keys(rootRegistry[name].versions),
    latest: rootRegistry[name]['dist-tags'].latest
  }))
};

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'index.json'),
  JSON.stringify(registryIndex, null, 2)
);

// Write npm-style "/-/all" endpoint for package listing
const dashDir = path.join(OUTPUT_DIR, '-');
if (!fs.existsSync(dashDir)) {
  fs.mkdirSync(dashDir, { recursive: true });
}

const allIndex = {};
Object.keys(rootRegistry).forEach(packageName => {
  allIndex[packageName] = rootRegistry[packageName];
});

fs.writeFileSync(
  path.join(dashDir, 'all'),
  JSON.stringify(allIndex, null, 2)
);
fs.writeFileSync(
  path.join(dashDir, 'all.json'),
  JSON.stringify(allIndex, null, 2)
);

// Generate HTML page
console.log('\n\n🌐 Generating HTML Page');
console.log('='.repeat(50));

const registryUrl = BASE_URL;
  
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Firebase Unity Package Registry</title>
  <style>
    body { font-family: system-ui; max-width: 1200px; margin: 40px auto; padding: 0 20px; background: #1a1a2e; color: #e0e0e0; }
    h1 { color: #FFCA28; }
    h2 { color: #FFA000; }
    h3 { color: #FFD54F; }
    a { color: #FFCA28; }
    a:hover { color: #FFE082; }
    pre { background: #0f0f1a; padding: 15px; border-radius: 5px; overflow-x: auto; border: 1px solid #2a2a4a; color: #c5c5d5; }
    .package { border: 1px solid #2a2a4a; padding: 15px; margin: 10px 0; border-radius: 5px; background: #16162b; }
    .package:hover { border-color: #FFA000; box-shadow: 0 0 8px rgba(255, 160, 0, 0.2); }
    .version { display: inline-block; background: #2a2a4a; color: #FFCA28; padding: 4px 8px; margin: 2px; border-radius: 3px; font-size: 0.9em; }
    code { background: #2a2a4a; padding: 2px 6px; border-radius: 3px; color: #FFCA28; }
    .version-badge { background: #FF6F00; color: #1a1a2e; padding: 4px 8px; margin-left: 5px; border-radius: 3px; font-size: 0.85em; font-weight: 600; }
  </style>
</head>
<body>
  <h1>🔥 Firebase Unity Package Registry</h1>
  <p>UPM-compatible Unity package registry for all Firebase SDK versions.</p>
  
  <h2>📦 Usage</h2>
  <p>Add this to your Unity project's <code>Packages/manifest.json</code>:</p>
  <pre>{
  "scopedRegistries": [{
    "name": "Firebase Me",
    "url": "${registryUrl}",
    "scopes": ["com.google.firebase"]
  }],
  "dependencies": {
    "com.google.firebase.analytics": "13.8.0",
    "com.google.firebase.auth": "10.0.0"
  }
}</pre>

  <h2>📋 Available Packages</h2>
  <p>All packages across major versions ${majorVersions.join(', ')}</p>
  ${Object.keys(rootRegistry).map(name => {
    const pkg = rootRegistry[name];
    const latest = pkg['dist-tags'].latest;
    const allVersions = Object.keys(pkg.versions).sort((a, b) => {
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if (aParts[i] !== bParts[i]) return bParts[i] - aParts[i];
      }
      return 0;
    });
    return `
  <div class="package">
    <h3>${pkg.versions[latest].displayName || name} <span class="version-badge">Latest: ${latest}</span></h3>
    <p><strong>Package:</strong> <code>${name}</code></p>
    <p><strong>Available versions:</strong> ${allVersions.map(v => `<span class="version">${v}</span>`).join(' ')}</p>
    <p>${pkg.versions[latest].description}</p>
  </div>`;
  }).join('')}
  
  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #2a2a4a; color: #888;">
    <p>Registry URL: <code>${registryUrl}</code></p>
    <p>Repository: <a href="${REPO_URL}">${REPO_URL}</a></p>
  </footer>
</body>
</html>`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), html);
console.log('  ✓ Root index page');

console.log(`\n✅ Registry built successfully!`);
console.log(`   Output: ${OUTPUT_DIR}`);
console.log(`   Packages: ${Object.keys(rootRegistry).length}`);
console.log(`   Total versions across all packages: ${Object.values(rootRegistry).reduce((sum, pkg) => sum + Object.keys(pkg.versions).length, 0)}`);
console.log(`   Major versions: ${majorVersions.join(', ')}`);
console.log(`\n🌐 Registry URL: ${BASE_URL}`);
console.log(`\n📦 Packages are served from:`);
majorVersions.forEach(v => {
  console.log(`   • /${v}/ - Firebase ${v}.x packages`);
});
