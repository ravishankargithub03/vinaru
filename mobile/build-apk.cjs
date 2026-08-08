#!/usr/bin/env node
// build-apk.cjs  —  Vinaru (React + Vite + Capacitor) → Android APK / AAB
//
// Usage:
//   npm run build:apk
//   npm run build:apk:release
//
// BEFORE FIRST BUILD:
//   1. npm install
//   2. npx cap add android   (creates android/ — one-time)
//   3. npm run build:apk

'use strict';

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const argv = process.argv.slice(2);
const IS_RELEASE = argv.includes('--release');
const IS_AAB = argv.includes('--aab');

const ROOT = __dirname;
const ANDROID_DIR = path.join(ROOT, 'android');
const WEB_DOWNLOADS = path.join(ROOT, '..', 'web', 'public', 'downloads');

function run(cmd, opts = {}) {
  const display = cmd.length > 110 ? cmd.slice(0, 110) + '…' : cmd;
  console.log(`\n  > ${display}`);
  execSync(cmd, { stdio: 'inherit', shell: true, env: process.env, ...opts });
}

function fileSize(p) {
  try {
    const b = fs.statSync(p).size;
    return b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;
  } catch {
    return '?';
  }
}

function globSubdirs(base, prefix) {
  try {
    if (!fs.existsSync(base)) return [];
    return fs.readdirSync(base)
      .filter((d) => d.startsWith(prefix))
      .map((d) => path.join(base, d));
  } catch {
    return [];
  }
}

function resolveJdk() {
  console.log('\n[1/10] Resolving JDK 21…');
  const candidates = [
    process.env.JAVA_HOME,
    ...globSubdirs('C:\\Program Files\\Microsoft', 'jdk-21'),
    ...globSubdirs('C:\\Program Files\\Java', 'jdk-21'),
    ...globSubdirs('C:\\Program Files\\Eclipse Adoptium', 'jdk-21'),
    ...globSubdirs(path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Microsoft'), 'jdk-21'),
  ].filter(Boolean);

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'bin', 'java.exe')) || fs.existsSync(path.join(dir, 'bin', 'java'))) {
      process.env.JAVA_HOME = dir;
      process.env.PATH = path.join(dir, 'bin') + path.delimiter + process.env.PATH;
      console.log(`  Found JDK: ${dir}`);
      return;
    }
  }

  const r = spawnSync('java', ['-version'], { encoding: 'utf8', shell: true });
  if (r.status === 0 || (r.stderr && r.stderr.includes('version'))) {
    console.log('  java found on PATH.');
    return;
  }

  if (os.platform() === 'win32') {
    console.log('  JDK 21 not found — installing via winget…');
    run('winget install --id Microsoft.OpenJDK.21 -e --accept-source-agreements --accept-package-agreements');
    const dirs = globSubdirs('C:\\Program Files\\Microsoft', 'jdk-21');
    if (dirs.length) {
      process.env.JAVA_HOME = dirs[0];
      process.env.PATH = path.join(dirs[0], 'bin') + path.delimiter + process.env.PATH;
      return;
    }
  }

  console.error('  JDK 21 not found. Install it and set JAVA_HOME.');
  process.exit(1);
}

function applyAndroidEnv(sdkRoot) {
  process.env.ANDROID_HOME = sdkRoot;
  process.env.ANDROID_SDK_ROOT = sdkRoot;
  process.env.PATH = [
    path.join(sdkRoot, 'cmdline-tools', 'latest', 'bin'),
    path.join(sdkRoot, 'platform-tools'),
    process.env.PATH,
  ].join(path.delimiter);
}

function resolveAndroidSdk() {
  console.log('\n[2/10] Resolving Android SDK…');
  const sdkRoot =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk');

  const latestBin = path.join(sdkRoot, 'cmdline-tools', 'latest', 'bin');
  if (fs.existsSync(latestBin)) {
    console.log(`  Found SDK: ${sdkRoot}`);
    applyAndroidEnv(sdkRoot);
    return;
  }

  console.log(`  SDK not found — downloading command-line tools to: ${sdkRoot}`);
  fs.mkdirSync(path.join(sdkRoot, 'cmdline-tools'), { recursive: true });
  const zipUrl =
    os.platform() === 'win32'
      ? 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip'
      : 'https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip';
  const zipPath = path.join(os.tmpdir(), 'android-cmdline-tools.zip');
  const extractTo = path.join(sdkRoot, 'cmdline-tools');

  if (os.platform() === 'win32') {
    run(`powershell -Command "Invoke-WebRequest -Uri '${zipUrl}' -OutFile '${zipPath}' -UseBasicParsing"`);
    run(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractTo}' -Force"`);
  } else {
    run(`curl -L -o "${zipPath}" "${zipUrl}"`);
    run(`unzip -q "${zipPath}" -d "${extractTo}"`);
  }

  const inner = path.join(extractTo, 'cmdline-tools');
  const latest = path.join(extractTo, 'latest');
  if (fs.existsSync(inner) && !fs.existsSync(latest)) fs.renameSync(inner, latest);
  applyAndroidEnv(sdkRoot);
}

function ensureSdkComponents() {
  console.log('\n[3/10] Ensuring SDK components (platform-35, build-tools-35)…');
  const sdkRoot = process.env.ANDROID_HOME;
  const sdkmanager = path.join(
    sdkRoot,
    'cmdline-tools',
    'latest',
    'bin',
    os.platform() === 'win32' ? 'sdkmanager.bat' : 'sdkmanager'
  );
  if (!fs.existsSync(sdkmanager)) {
    console.error(`  sdkmanager not found: ${sdkmanager}`);
    process.exit(1);
  }

  const platformDir = path.join(sdkRoot, 'platforms', 'android-35');
  const buildToolsDir = path.join(sdkRoot, 'build-tools', '35.0.0');
  if (fs.existsSync(platformDir) && fs.existsSync(buildToolsDir)) {
    console.log('  SDK components already present — skipping install.');
    return;
  }

  spawnSync(sdkmanager, ['--licenses'], {
    input: 'y\n'.repeat(20),
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
    shell: true,
  });
  run(`"${sdkmanager}" "platforms;android-35" "build-tools;35.0.0" "platform-tools"`);
}

function writeLocalProperties() {
  console.log('\n[4/10] Writing android/local.properties…');
  if (!fs.existsSync(ANDROID_DIR)) {
    console.error('\n  ERROR: android/ directory not found.');
    console.error('  Run once: npx cap add android');
    process.exit(1);
  }
  const sdkPath = process.env.ANDROID_HOME.replace(/\\/g, '\\\\');
  fs.writeFileSync(path.join(ANDROID_DIR, 'local.properties'), `sdk.dir=${sdkPath}\n`);
  console.log(`  sdk.dir = ${process.env.ANDROID_HOME}`);
}

function checkKeystore() {
  if (!IS_RELEASE && !IS_AAB) return;
  console.log('\n[5/10] Verifying release keystore…');
  const propsFile = path.join(ANDROID_DIR, 'keystore.properties');
  if (!fs.existsSync(propsFile)) {
    console.error('\n  ERROR: android/keystore.properties not found.');
    console.error('  Generate a keystore and keystore.properties before release builds.');
    process.exit(1);
  }
  console.log('  keystore.properties OK.');
}

function bumpVersionCode() {
  console.log('\n[6/10] Auto-incrementing versionCode…');
  const buildGradle = path.join(ANDROID_DIR, 'app', 'build.gradle');
  if (!fs.existsSync(buildGradle)) {
    console.warn('  android/app/build.gradle not found — skipping version bump.');
    return;
  }
  let content = fs.readFileSync(buildGradle, 'utf8');
  const match = content.match(/versionCode\s+(\d+)/);
  if (!match) {
    console.warn('  versionCode not found — skipping bump.');
    return;
  }
  const current = parseInt(match[1], 10);
  const next = current + 1;
  content = content.replace(/versionCode\s+\d+/, `versionCode ${next}`);
  fs.writeFileSync(buildGradle, content);
  console.log(`  versionCode: ${current} → ${next}`);
}

function buildVite() {
  console.log('\n[7/10] Building React app (outDir=dist-apk)…');
  const distApk = path.join(ROOT, 'dist-apk');
  if (fs.existsSync(distApk)) fs.rmSync(distApk, { recursive: true, force: true });
  run('npx vite build --outDir dist-apk', { cwd: ROOT });
}

function capSync() {
  console.log('\n[8/10] Syncing web assets to Android project (cap sync)…');
  run('npx cap sync android', { cwd: ROOT });
}

function gradleBuild() {
  console.log('\n[9/10] Running Gradle build…');
  const gradlew = path.join(ANDROID_DIR, os.platform() === 'win32' ? 'gradlew.bat' : 'gradlew');
  if (!fs.existsSync(gradlew)) {
    console.error('  gradlew not found. Run: npx cap add android');
    process.exit(1);
  }
  const task = IS_AAB ? 'bundleRelease' : IS_RELEASE ? 'assembleRelease' : 'assembleDebug';
  process.env.GRADLE_OPTS = [process.env.GRADLE_OPTS, '-Dorg.gradle.daemon=false', '-Xmx2048m']
    .filter(Boolean)
    .join(' ');
  run(`"${gradlew}" ${task} --no-daemon`, { cwd: ANDROID_DIR });
}

function copyOutput() {
  console.log('\n[10/10] Copying build output…');
  fs.mkdirSync(WEB_DOWNLOADS, { recursive: true });

  let src;
  let filename;
  if (IS_AAB) {
    src = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
    filename = 'vinaru-1.0.0.aab';
  } else if (IS_RELEASE) {
    src = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
    filename = 'vinaru-1.0.0.apk';
  } else {
    src = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
    filename = 'vinaru-1.0.0.apk';
  }

  if (!fs.existsSync(src)) {
    console.error(`\n  Build output not found: ${src}`);
    process.exit(1);
  }

  const dest = path.join(WEB_DOWNLOADS, filename);
  fs.copyFileSync(src, dest);
  console.log(`\n  Output : ${dest}`);
  console.log(`  Size   : ${fileSize(dest)}`);
}

(function main() {
  const mode = IS_AAB ? 'Signed AAB (Play Store)' : IS_RELEASE ? 'Signed Release APK' : 'Debug APK';
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║        Vinaru — Android Build            ║');
  console.log(`║  Mode: ${mode.padEnd(34)}║`);
  console.log('╚══════════════════════════════════════════╝');

  resolveJdk();
  resolveAndroidSdk();
  ensureSdkComponents();
  writeLocalProperties();
  checkKeystore();
  bumpVersionCode();
  buildVite();
  capSync();
  gradleBuild();
  copyOutput();

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  Build complete!                         ║');
  console.log('║  web/public/downloads/vinaru-1.0.0.apk   ║');
  console.log('╚══════════════════════════════════════════╝\n');
})();
