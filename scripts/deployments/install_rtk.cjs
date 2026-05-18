// scripts/deployments/install_rtk.cjs
// Installation script for RTK (Rust Token Killer) in Windows/VS Code Workspace
// Enforces absolute security, zero-trust, and Clean Tree mandate.

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  🚀 INSTALLING RUST TOKEN KILLER (RTK) FOR WORKSPACE     ║");
console.log("╚══════════════════════════════════════════════════════════╝");

const workspaceDir = path.resolve(__dirname, '../../');
const binDir = path.join(workspaceDir, '.bin');
const zipPath = path.join(binDir, 'rtk.zip');
const exePath = path.join(binDir, 'rtk.exe');

// 1. Create .bin folder if not exists
if (!fs.existsSync(binDir)) {
  console.log("[1/4] Creating local bin directory...");
  fs.mkdirSync(binDir, { recursive: true });
} else {
  console.log("[1/4] Local bin directory already exists.");
}

// 2. Download zip from latest GitHub release
const downloadUrl = 'https://github.com/rtk-ai/rtk/releases/download/v0.40.0/rtk-x86_64-pc-windows-msvc.zip';
console.log(`[2/4] Downloading RTK from ${downloadUrl}...`);

const file = fs.createWriteStream(zipPath);

function downloadFile(url) {
  https.get(url, (response) => {
    if (response.statusCode === 302 || response.statusCode === 301) {
      // Handle redirect
      downloadFile(response.headers.location);
    } else if (response.statusCode === 200) {
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          extractFile();
        });
      });
    } else {
      console.error(`Failed to download: Status Code ${response.statusCode}`);
      fs.unlinkSync(zipPath);
      process.exit(1);
    }
  }).on('error', (err) => {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    console.error(`Error downloading file: ${err.message}`);
    process.exit(1);
  });
}

downloadFile(downloadUrl);

function extractFile() {
  console.log("[3/4] Extracting rtk.exe...");
  try {
    // We can use PowerShell via Node child_process to extract it cleanly
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${binDir}' -Force"`);
  } catch (error) {
    console.error("Extraction failed:", error.message);
    process.exit(1);
  }

  // 4. Clean up temporary files (Git Hygiene)
  console.log("[4/4] Cleaning up zip archive...");
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  if (fs.existsSync(exePath)) {
    console.log("\n✅ SUCCESS: RTK has been installed to your workspace!");
    console.log(`Location: ${exePath}`);
    console.log("\nTo use it in your terminal, add this directory to your session PATH:");
    console.log(`$env:PATH += ";${binDir}"`);
    console.log("Or run it directly using: .\\.bin\\rtk");
  } else {
    console.error("Failed to find rtk.exe after extraction.");
    process.exit(1);
  }
}
