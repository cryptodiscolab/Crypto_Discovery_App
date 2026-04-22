import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const oldVersion = 'v3.42.12';
const newVersion = 'v3.42.13';

const files = [
    'PRD/DISCO_DAILY_MASTER_PRD.md',
    '.agents/WORKSPACE_MAP.md',
    '.agents/gemini.md',
    '.agents/CLAUDE.md',
    '.cursorrules'
];

console.log(`Bumping ecosystem version from ${oldVersion} to ${newVersion}...`);

for (const relPath of files) {
    const filePath = path.resolve(relPath);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replaceAll(oldVersion, newVersion);
        
        // Specific logic for PRD
        if (relPath.includes('DISCO_DAILY_MASTER_PRD.md')) {
            const dateStr = new Date().toISOString().split('T')[0];
            const workReportTemplate = `## 11. Work Report  ${newVersion} (Current)
**Date:** ${dateStr}
**Subject:** Base Ecosystem Integration: Builder Code & Gasless Paymaster.
**Implementation:** Pendaftaran aplikasi "Crypto Discovery" (ID: 697ca52ec0622780c63f6665) secara sukses ke base.dev menggunakan verifikasi Domain Meta Tag (base:app_id). Integrasi Coinbase Developer Platform (CDP) API SDK dengan mengamankan CDP_API_SECRET dan Builder Code (ERC-8021) ke dalam Zero-Leak Vercel Env Pipeline.
**Result:** App berhasil terverifikasi on-chain. Kesiapan operasional penuh untuk mengeksekusi Gasless Transactions (Paymaster) dan pelacakan atribusi Referral/Builder di jaringan Base.

---

`;
            // Insert after line "## 11. Work Report  v3.42.12" which was updated via replaceAll
            content = content.replace(`## 11. Work Report  ${newVersion} (Current)`, `## 11. Work Report  ${oldVersion} (Legacy)`);
            
            // Insert new report at the top of the history
            content = content.replace(`## 11. Work Report  ${oldVersion} (Legacy)`, workReportTemplate + `## 11.1 Work Report  ${oldVersion} (Legacy)`);
        }

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Updated ${relPath}`);
    } else {
        console.warn(`⚠️ File not found: ${filePath}`);
    }
}

// Generate HTML
try {
    console.log('Generating PRD HTML...');
    execSync('npx marked PRD/DISCO_DAILY_MASTER_PRD.md -o PRD/DISCO_DAILY_MASTER_PRD.html', { stdio: 'inherit' });
    console.log('✅ HTML generated.');
} catch (e) {
    console.warn('⚠️ marked generation failed:', e.message);
}

console.log('Update Complete.');
