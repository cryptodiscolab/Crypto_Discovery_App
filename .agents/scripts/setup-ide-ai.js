import fs from 'fs';
import path from 'path';
import os from 'os';

console.log('🤖 [IDE Setup] Memulai konfigurasi integrasi IDE (Cursor / VS Code / IDX)...');

const homeDir = os.homedir();
const continueDir = path.join(homeDir, '.continue');
const configFile = path.join(continueDir, 'config.json');

// Ensure ~/.continue directory exists
if (!fs.existsSync(continueDir)) {
    fs.mkdirSync(continueDir, { recursive: true });
}

const customConfig = {
    "models": [
        {
            "title": "Qwen 2.5 Coder (1.5B)",
            "provider": "ollama",
            "model": "qwen2.5-coder:1.5b",
            "apiBase": "http://localhost:11434"
        },
        {
            "title": "DeepSeek Coder (1.3B)",
            "provider": "ollama",
            "model": "deepseek-coder:1.3b",
            "apiBase": "http://localhost:11434"
        }
    ],
    "tabAutocompleteModel": {
        "title": "Qwen Autocomplete",
        "provider": "ollama",
        "model": "qwen2.5-coder:1.5b",
        "apiBase": "http://localhost:11434"
    },
    "allowAnonymousTelemetry": false,
    "systemMessage": "You are the Lead Blockchain Architect for Crypto Disco App. You follow the rules of the .cursorrules and answer in Indonesian. Think deeply, but explain quickly in maximum 3 bullet points unless asked otherwise. Optimize for low-end hardware if asked."
};

try {
    // Backup existing if any
    if (fs.existsSync(configFile)) {
        const backupPath = `${configFile}.bak_${Date.now()}`;
        fs.copyFileSync(configFile, backupPath);
        console.log(`✅ [Backup] Konfigurasi lama disimpan di: ${backupPath}`);
    }

    fs.writeFileSync(configFile, JSON.stringify(customConfig, null, 2));
    console.log('✅ [IDE Setup] Konfigurasi Continue.dev untuk Ollama (Qwen & DeepSeek) berhasil dipasang!');
    console.log(`📁 Lokasi file: ${configFile}`);
    console.log('\n🌟 Langkah Selanjutnya (di VS Code / Cursor):');
    console.log('1. Install ekstensi "Continue" dari Extension Marketplace.');
    console.log('2. Buka tab Continue di sidebar, Qwen dan DeepSeek sudah otomatis tersedia di dropdown model!');
} catch (error) {
    console.error('❌ [Error] Gagal menulis konfigurasi IDE:', error.message);
}
