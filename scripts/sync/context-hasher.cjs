#!/usr/bin/env node
'use strict';

/**
 * Super Ketat — Context Hasher & Cache Manager
 * Digunakan untuk mengecek apakah file sudah pernah di-summarize untuk menghemat token.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load .env
const rootEnv = path.resolve(process.cwd(), '.env');
const raffleEnv = path.resolve(process.cwd(), 'Raffle_Frontend', '.env');
const envPath = fs.existsSync(rootEnv) ? rootEnv : raffleEnv;
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function getFileHash(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

async function checkCache(filePath) {
    const absPath = path.resolve(filePath);
    const relPath = path.relative(process.cwd(), absPath).replace(/\\/g, '/');
    const hash = getFileHash(absPath);

    if (!hash) {
        return { status: 'NOT_FOUND', path: relPath };
    }

    const { data, error } = await supabase
        .from('agent_vault')
        .select('hash, summary, updated_at')
        .eq('file_path', relPath)
        .single();

    if (error || !data || data.hash !== hash) {
        return { status: 'MISSING_OR_STALE', path: relPath, currentHash: hash, cachedHash: data?.hash };
    }

    return { status: 'HIT', path: relPath, summary: data.summary, hash: hash, updated_at: data.updated_at };
}

async function updateCache(filePath, summary) {
    const absPath = path.resolve(filePath);
    const relPath = path.relative(process.cwd(), absPath).replace(/\\/g, '/');
    const hash = getFileHash(absPath);
    const content = fs.readFileSync(absPath, 'utf8');

    const category = relPath.includes('cursorrules') ? 'protocol' :
        relPath.includes('skills') ? 'skill' : 
        relPath.includes('PRD') ? 'prd' : 'script';

    const { error } = await supabase
        .from('agent_vault')
        .upsert({
            file_path: relPath,
            content: content,
            hash: hash,
            summary: summary,
            category: category,
            updated_at: new Date().toISOString()
        }, { onConflict: 'file_path' });

    if (error) {
        console.error(`❌ Failed to update cache for ${relPath}:`, error.message);
        return false;
    }

    console.log(`✅ Cache updated for ${relPath}`);
    return true;
}

const args = process.argv.slice(2);
const command = args[0];
const targetFile = args[1];
const summary = args.slice(2).join(' ');

async function main() {
    if (command === 'check') {
        const result = await checkCache(targetFile);
        console.log(JSON.stringify(result, null, 2));
    } else if (command === 'set') {
        const result = await updateCache(targetFile, summary);
        process.exit(result ? 0 : 1);
    } else {
        console.log('Usage: node scripts/sync/context-hasher.cjs [check|set] [file_path] [summary]');
    }
}

main();
