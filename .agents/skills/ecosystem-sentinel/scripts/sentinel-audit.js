#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Sentinel Security & UI Auditor
 * Dijalankan dari: ROOT repo (e.g. `node .agents/skills/ecosystem-sentinel/scripts/sentinel-audit.js`)
 * ROOT_DIR: 4 level naik dari /scripts/ → /ecosystem-sentinel/ → /skills/ → /.agents/ → ROOT
 */

const ROOT_DIR = path.resolve(__dirname, '../../../../');
const RAFFLE_FRONTEND_DIR = path.join(ROOT_DIR, 'Raffle_Frontend');

// Keys yang TIDAK boleh di-hardcode sebagai literal string di kode
// Setiap entry: { pattern: RegExp, validate: (matchArr) => boolean }
const FORBIDDEN_KEY_PATTERNS = [
    {
        // Private key wallet: 64 random hex chars setelah 0x
        // EXCLUDE: bytes32 zero-padded role hashes & zero addresses & keccak role hashes
        pattern: /(['"`])0x([a-fA-F0-9]{64})\1/,
        validate: (m) => {
            const hex = m[2];
            const isAllZeros = /^0+$/.test(hex);
            const isLeftZeroPadded = hex.startsWith('000000000000000000000000'); // bytes32 leftpad (address in bytes32)
            // keccak role hash ciri khas: banyak trailing zeros (right-padded ke bytes32)
            const trailingZeros = (hex.match(/0+$/) || [''])[0].length;
            const totalZeros = (hex.match(/0/g) || []).length;
            const zeroRatio = totalZeros / 64;
            // Private key: hampir tidak ada pattern repetitif; role hash: zero ratio > 45% atau trailing > 16 zeros
            return !isAllZeros && !isLeftZeroPadded && trailingZeros < 16 && zeroRatio < 0.45;
        }
    },
    {
        // Service role JWT (base64 encoded header eyJ...)
        pattern: /(['"`])eyJ[a-zA-Z0-9_\-]{30,}\.[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\1/,
        validate: () => true
    },
];

// Path yang aman untuk dijalankan (skip dari audit security)
const SAFE_SKIP_PATTERNS = [
    'node_modules',
    '.git',
    'dist',
    '.env',
    'abis_data.txt',
    '__tests__',
    '.test.',
    '.spec.',
];

// Kata bahasa Indonesia yang SPESIFIK dan tidak ambigu (dalam konteks JSX string)
// Hindari kata yang bisa jadi nama variabel/property yang valid
const ID_STRING_PATTERNS = [
    /["'`](.*?\b(kamu|anda|untuk dengan|silakan masuk|klaim harian|berhasil diklaim|gagal memproses|tunggu konfirmasi)\b.*?)["'`]/i,
];

const EXTENSIONS_TO_SCAN = ['.js', '.jsx', '.ts', '.tsx'];
const JSX_EXTENSIONS = ['.jsx', '.tsx'];

// ── Utility ──────────────────────────────────────────────────────────────────

function shouldSkip(filePath) {
    return SAFE_SKIP_PATTERNS.some(p => filePath.replace(/\\/g, '/').includes(p));
}

function walkDir(dir, callback) {
    if (!fs.existsSync(dir)) {
        console.warn(`⚠️  Directory tidak ditemukan, skip: ${dir}`);
        return;
    }
    try {
        fs.readdirSync(dir).forEach(f => {
            const fullPath = path.join(dir, f);
            // ⚡ Skip blacklisted directories EARLY — before entering them
            // Ini mencegah traversal ke node_modules (56k+ files) yang menyebabkan hang
            if (shouldSkip(fullPath)) return;
            try {
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    walkDir(fullPath, callback);
                } else {
                    callback(fullPath);
                }
            } catch {
                // Ignore permission errors
            }
        });
    } catch {
        // Ignore unreadable directories
    }
}

function isLineAComment(line) {
    const trimmed = line.trim();
    return (
        trimmed.startsWith('//') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('#')
    );
}

// ── Security Scan: Hardcoded Secrets ─────────────────────────────────────────

function auditHardcodedSecrets() {
    console.log('\n--- 🔐 Security Scan: Hardcoded Secrets ---');
    let issues = 0;

    walkDir(RAFFLE_FRONTEND_DIR, filePath => {
        if (shouldSkip(filePath)) return;
        const ext = path.extname(filePath);
        if (!EXTENSIONS_TO_SCAN.includes(ext)) return;

        let content;
        try {
            content = fs.readFileSync(filePath, 'utf8');
        } catch {
            return;
        }

        FORBIDDEN_KEY_PATTERNS.forEach(({ pattern, validate }) => {
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                if (isLineAComment(line)) return;
                const match = line.match(pattern);
                if (match && validate(match)) {
                    console.error(
                        `❌ [CRITICAL] Hardcoded secret detected in ${path.relative(ROOT_DIR, filePath)}:L${i + 1}`
                    );
                    // Jangan print value-nya untuk keamanan
                    issues++;
                }
            });
        });
    });

    if (issues === 0) {
        console.log('  ✅ No hardcoded secrets found.');
    }
    return issues;
}

// ── UI Language Audit: English Only ──────────────────────────────────────────

function auditUILanguage() {
    console.log('\n--- 🌐 UI Language Audit (English Only in JSX strings) ---');
    const uiPaths = [
        path.join(RAFFLE_FRONTEND_DIR, 'src/components'),
        path.join(RAFFLE_FRONTEND_DIR, 'src/app'),
        path.join(RAFFLE_FRONTEND_DIR, 'src/pages'),
    ];

    let warnings = 0;

    uiPaths.forEach(uiPath => {
        walkDir(uiPath, filePath => {
            if (shouldSkip(filePath)) return;
            const ext = path.extname(filePath);
            if (!JSX_EXTENSIONS.includes(ext)) return;

            let lines;
            try {
                lines = fs.readFileSync(filePath, 'utf8').split('\n');
            } catch {
                return;
            }

            lines.forEach((line, lineNum) => {
                if (isLineAComment(line)) return;
                if (line.trim().startsWith('import')) return;

                ID_STRING_PATTERNS.forEach(pattern => {
                    if (pattern.test(line)) {
                        console.warn(
                            `⚠️  [WARN] Indonesian string (Rule 11) in ${path.relative(ROOT_DIR, filePath)}:L${lineNum + 1}`
                        );
                        console.warn(`   → "${line.trim().substring(0, 100)}"`);
                        warnings++;
                    }
                });
            });
        });
    });

    if (warnings === 0) {
        console.log('  ✅ No Indonesian strings detected in UI components.');
    }
    return warnings;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
    console.log('🛡️  Sentinel Security & UI Audit — Starting...');
    console.log(`📁 ROOT_DIR: ${ROOT_DIR}`);
    console.log(`📁 RAFFLE_FRONTEND: ${RAFFLE_FRONTEND_DIR}`);

    if (!fs.existsSync(RAFFLE_FRONTEND_DIR)) {
        console.error('❌ [FATAL] Raffle_Frontend directory not found! Check working directory.');
        process.exit(1);
    }

    const criticalIssues = auditHardcodedSecrets();
    const uiWarnings = auditUILanguage();

    console.log('\n══════════════════════════════════════════');
    console.log('📋 SENTINEL AUDIT SUMMARY');
    console.log('══════════════════════════════════════════');

    if (criticalIssues === 0 && uiWarnings === 0) {
        console.log('✨ All checks passed! Ecosystem is clean.');
        process.exit(0);
    }

    if (criticalIssues > 0) {
        console.error(`\n🚨 CRITICAL: ${criticalIssues} hardcoded secret(s) found — FIX IMMEDIATELY!`);
        // CRITICAL issues → fail CI (exit 1)
        process.exit(1);
    }

    if (uiWarnings > 0) {
        console.warn(`\n⚠️  WARNINGS: ${uiWarnings} UI language issue(s) found — review recommended.`);
        // Warnings only → pass CI (exit 0) tapi laporan tercetak
        process.exit(0);
    }
}

main();
