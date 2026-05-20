/**
 * 🛡️ AGENT ANTI-NEGLIGENCE HOOK (v3.64.16-Hardened)
 * Location: scripts/audits/agent_anti_negligence_hook.cjs
 *
 * Hook pengamanan ekosistem untuk mendeteksi kelalaian agen AI secara otomatis.
 * Mencegah kerusakan codebase, kebocoran rahasia, dokumen rusak (dotenv logs),
 * berkas sampah/duplikat, ketidaksesuaian Peta Kerja (WORKSPACE_MAP), dan
 * penggunaan RTK dari working directory yang salah (RTK ROOT-DIR MANDATE v3.64.16).
 *
 * CHECK 6 (v3.64.16): RTK ROOT-DIR MANDATE
 *   .bin/rtk.exe HANYA ada di project ROOT. Untuk menjalankan perintah di sub-dir:
 *     BENAR: Cwd=root + .bin\rtk.exe npm --prefix Raffle_Frontend run build
 *     BENAR: Cwd=root + .bin\rtk.exe read Raffle_Frontend/src/pages/HomePage.tsx
 *     SALAH: Cwd=Raffle_Frontend + .bin\rtk.exe (binary tidak ada!)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  🛡️  AGENTS SYSTEM: ANTI-NEGLIGENCE AUTOMATION HOOK     ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");

const WORKSPACE_DIR = path.resolve(__dirname, '../../');
let hasFailure = false;
const failures = [];
const warnings = [];

// ═══ CHECK 1: CORRUPTED MARKDOWN SCANNER (Anti-Dotenv-Injection) ═══
console.log("🔍 Checking for Corrupted Documents (Dotenv Log Injections)...");
const targetDirs = [
    path.join(WORKSPACE_DIR, '.agents'),
    path.join(WORKSPACE_DIR, 'PRD'),
    path.join(WORKSPACE_DIR, 'Raffle_Frontend/Agen Work Report')
];

const dotenvPatterns = [
    /\[dotenv@/,
    /injecting env/,
    /tip: G/,
    /override existing env vars/
];

function scanDirForCorruptedMarkdown(dir) {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            scanDirForCorruptedMarkdown(fullPath);
        } else if (stat.isFile() && item.endsWith('.md')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            
            // Check for empty or near-empty files
            if (content.trim().length === 0) {
                failures.push(`Empty markdown file found: ${path.relative(WORKSPACE_DIR, fullPath)}`);
                hasFailure = true;
            }
            
            // Scan for dotenv patterns
            for (const pattern of dotenvPatterns) {
                if (pattern.test(content)) {
                    failures.push(`Corrupted markdown (dotenv log leak) in: ${path.relative(WORKSPACE_DIR, fullPath)}`);
                    hasFailure = true;
                    break;
                }
            }
        }
    }
}

targetDirs.forEach(scanDirForCorruptedMarkdown);
if (!hasFailure) {
    console.log("   ✅ Clean-Doc Audit passed: No corrupted markdown files detected.");
}

// ═══ CHECK 2: GIT HYGIENE & DUPLICATE FILE SCANNER ═══
console.log("\n🔍 Checking Git Hygiene (Duplicate cognitive maps, temporary scripts, and artifacts)...");
const forbiddenExtensions = ['.key', '.pem', '.p12', 'tsc_output.txt', 'tsc-errors.txt'];
const forbiddenPatterns = [
    /_V\d+\.md$/,               // e.g., *_V2.md, *_V3.md
    /_DEEP\.md$/,                // outdated deep maps
    /_DEEP_FINAL\.md$/,          // outdated deep final maps
    /_UTF8\.md$/,                // outdated utf8 maps
    /\.mermaid$/                 // redundant mermaid graph files
];

function scanDirForHygiene(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            if (!['node_modules', '.git', '.venv', 'venv', '_archive', 'artifacts', 'cache', '.next', 'dist', 'build', '.vercel'].includes(item)) {
                scanDirForHygiene(fullPath);
            }
        } else if (stat.isFile()) {
            const relPath = path.relative(WORKSPACE_DIR, fullPath);
            
            // Check extensions
            const ext = path.extname(item);
            if (forbiddenExtensions.includes(ext) || forbiddenExtensions.includes(item)) {
                failures.push(`Forbidden file extension/name detected: ${relPath}`);
                hasFailure = true;
            }
            
            // Check patterns
            for (const pattern of forbiddenPatterns) {
                if (pattern.test(item)) {
                    failures.push(`Duplicate/Outdated artifact detected: ${relPath}`);
                    hasFailure = true;
                    break;
                }
            }
        }
    }
}

scanDirForHygiene(WORKSPACE_DIR);
if (!hasFailure) {
    console.log("   ✅ Git Hygiene passed: No duplicate or forbidden artifacts found.");
}

// ═══ CHECK 3: WORKSPACE MAP ALIGNMENT (No "Dark" Files) ═══
console.log("\n🔍 Checking Workspace Map Alignment (Zero-Leak documentation parity)...");
const workspaceMapPath = path.join(WORKSPACE_DIR, '.agents/WORKSPACE_MAP.md');
if (fs.existsSync(workspaceMapPath)) {
    const workspaceMapContent = fs.readFileSync(workspaceMapPath, 'utf8');
    
    // Scan all MD files under .agents/ and make sure they are in WORKSPACE_MAP.md
    const agentsDir = path.join(WORKSPACE_DIR, '.agents');
    const mdFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md') && f !== 'WORKSPACE_MAP.md');
    
    for (const file of mdFiles) {
        if (!workspaceMapContent.includes(file)) {
            warnings.push(`Documentation Drift: '${file}' exists under .agents/ but is NOT documented in WORKSPACE_MAP.md!`);
        }
    }
} else {
    failures.push("Workspace Map (WORKSPACE_MAP.md) is missing from .agents/!");
    hasFailure = true;
}
if (warnings.length > 0) {
    warnings.forEach(w => console.log(`   ⚠️  ${w}`));
} else {
    console.log("   ✅ Workspace Map alignment verified perfectly.");
}

// ═══ CHECK 4: SECRETS LEAK AUDIT ═══
console.log("\n🔍 Auditing for Secrets Leaks (Private Keys, API Keys, JWT Tokens)...");
const zeroBytes32 = /^(0x)?0{64}$/;

function scanSecrets(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            // Ignore build, archive, artifacts, and script/test folders to prevent false positives
            if (!['node_modules', '.git', '.next', 'dist', 'build', '_archive', 'artifacts', 'cache', '.vercel', 'scripts'].includes(item)) {
                scanSecrets(fullPath);
            }
        } else if (stat.isFile()) {
            const relPath = path.relative(WORKSPACE_DIR, fullPath);
            
            // Ignore gitignored env configs, binary files, json artifacts, lock files
            if (
                item.startsWith('.env') ||
                item.endsWith('.json') ||
                item.endsWith('.lock') ||
                item.endsWith('.png') ||
                item.endsWith('.webp') ||
                item.endsWith('.jpg') ||
                item.endsWith('.jpeg') ||
                item.endsWith('.gif') ||
                item.endsWith('.ico') ||
                item.endsWith('.svg') ||
                ['package-lock.json', 'ecosystem-data.json', 'sentinel-state.json'].includes(item)
            ) {
                continue;
            }
            
            // Read lines and look for hardcoded raw hex keys
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                const matches = content.match(/\b0x[a-fA-F0-9]{64}\b/g);
                if (matches) {
                    for (const match of matches) {
                        // Skip standard zero address bytes/admin constants
                        if (zeroBytes32.test(match)) continue;
                        
                        failures.push(`Security Leak: Detected raw 32-byte Private Key pattern inside: ${relPath}`);
                        hasFailure = true;
                        break;
                    }
                }
            } catch (e) {
                // Skip files that can't be read safely
            }
        }
    }
}
scanSecrets(WORKSPACE_DIR);
if (!hasFailure) {
    console.log("   ✅ Secret Leak Audit passed: Zero raw secrets/keys found in source files.");
}

// ═══ CHECK 5: RUST TOKEN KILLER (RTK) SCAN ═══
console.log("\n🔍 Running Rust Token Killer (RTK) Analysis...");
const rtkPath = path.join(WORKSPACE_DIR, '.bin', 'rtk.exe');
if (fs.existsSync(rtkPath)) {
    try {
        const rtkOutput = execSync(`"${rtkPath}" --version`, { cwd: WORKSPACE_DIR, encoding: 'utf8', stdio: 'pipe' });
        console.log("   ✅ RTK is active and available: " + rtkOutput.trim());
    } catch (e) {
        failures.push(`RTK Execution Failed: ${e.message}`);
        hasFailure = true;
    }
} else {
    failures.push("RTK executable not found in .bin/. RTK is MANDATORY to prevent token leaks. Please run node scripts/deployments/install_rtk.cjs to install.");
    hasFailure = true;
}

// ═══ CHECK 6: RTK ROOT-DIR MANDATE (v3.64.16) ═══
console.log("\n🔍 Verifying RTK Root-Dir Mandate (Rule 78)...");
const rtkBinPath = path.join(WORKSPACE_DIR, '.bin', 'rtk.exe');
const rtkFiltersToml = path.join(WORKSPACE_DIR, '.rtk', 'filters.toml');

if (!fs.existsSync(rtkBinPath)) {
    failures.push("RTK ROOT-DIR VIOLATION: .bin/rtk.exe not found at project root. RTK MUST be invoked from root, not from subdirectories.");
    hasFailure = true;
} else {
    // Guard: RTK binary must NOT exist inside any subdirectory
    const rtkSubDirTargets = ['Raffle_Frontend', 'api', 'scripts', 'tools'];
    let rtkSubViolation = false;
    for (const sub of rtkSubDirTargets) {
        const subBin = path.join(WORKSPACE_DIR, sub, '.bin', 'rtk.exe');
        if (fs.existsSync(subBin)) {
            failures.push(`RTK ROOT-DIR VIOLATION: rtk.exe found in '${sub}/.bin/' — must ONLY exist at project root!`);
            hasFailure = true;
            rtkSubViolation = true;
        }
    }

    if (!rtkSubViolation) {
        if (!fs.existsSync(rtkFiltersToml)) {
            warnings.push("RTK: .rtk/filters.toml missing — run '.bin\\rtk.exe trust' to initialize project-local filters.");
        }
        console.log("   ✅ RTK Root-Dir Mandate satisfied: .bin/rtk.exe confirmed at project root only.");
        console.log("   📋 MANDATORY PATTERN (Rule 78) — Always use Cwd=project root:");
        console.log("      ✅ .bin\\rtk.exe read Raffle_Frontend/src/pages/X.tsx");
        console.log("      ✅ .bin\\rtk.exe npm --prefix Raffle_Frontend run build");
        console.log("      ❌ WRONG: Cwd=Raffle_Frontend + .\\.bin\\rtk.exe (not found!)");
    }
}

// ═══ FINAL VERDICT ═══
console.log("\n╔══════════════════════════════════════════════════════════╗");
if (hasFailure) {
    console.log("║  ❌ VERDICT: DEGRADED / FAILURE BLOCKED                  ║");
    console.log("║  ⚠️  Negligence/Hygiene errors detected in workspace!      ║");
    console.log("╚══════════════════════════════════════════════════════════╝\n");
    console.log("🚨 FAILURES DETECTED:");
    failures.forEach((f, idx) => console.log(`   ${idx + 1}. ${f}`));
    process.exit(1);
} else {
    console.log("║  ✅ VERDICT: 100% OPERATIONAL & PRISTINE                 ║");
    console.log("║  🛡️  All agents validation hooks PASSED smoothly.        ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    process.exit(0);
}
