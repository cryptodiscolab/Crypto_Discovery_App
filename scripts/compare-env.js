import fs from 'fs';

function parseEnv(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const env = {};
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const index = trimmed.indexOf('=');
        if (index === -1) continue;
        const key = trimmed.substring(0, index).trim();
        let value = trimmed.substring(index + 1).trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.substring(1, value.length - 1);
        }
        env[key] = value;
    }
    return env;
}

const localEnv = parseEnv('.env');
const vercelEnv = parseEnv('.env.vercel.prod');

const localKeys = Object.keys(localEnv);
const vercelKeys = Object.keys(vercelEnv);

console.log('Comparing .env vs .env.vercel...\n');

const missingInVercel = localKeys.filter(k => !vercelKeys.includes(k));
const differentValue = localKeys.filter(k => vercelKeys.includes(k) && localEnv[k] !== vercelEnv[k]);
const extraInVercel = vercelKeys.filter(k => !localKeys.includes(k));

if (missingInVercel.length > 0) {
    console.log('❌ Missing in Vercel:');
    missingInVercel.forEach(k => console.log(`  - ${k}`));
} else {
    console.log('✅ No missing keys in Vercel.');
}

if (differentValue.length > 0) {
    console.log('\n⚠️ Different values (Local vs Vercel):');
    differentValue.forEach(k => {
        // Redact secrets
        const localVal = k.toLowerCase().includes('key') || k.toLowerCase().includes('secret') || k.toLowerCase().includes('token') || k.toLowerCase().includes('private') ? '[REDACTED]' : localEnv[k];
        const vercelVal = k.toLowerCase().includes('key') || k.toLowerCase().includes('secret') || k.toLowerCase().includes('token') || k.toLowerCase().includes('private') ? '[REDACTED]' : vercelEnv[k];
        console.log(`  - ${k}: ${localVal} vs ${vercelVal}`);
    });
} else {
    console.log('\n✅ All common keys have identical values.');
}

if (extraInVercel.length > 0) {
    console.log('\nℹ️ Extra in Vercel (not in local .env):');
    extraInVercel.forEach(k => console.log(`  - ${k}`));
}
