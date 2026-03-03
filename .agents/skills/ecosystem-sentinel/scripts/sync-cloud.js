import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../..');

// Load environment variables
const envPath = path.join(ROOT_DIR, '.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rbgzwhsdqnhwrwimjjfm.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is required to push AI configs to Supabase.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const STORAGE_BUCKET = 'ai-config'; // Pastikan bucket ini dibuat di Supabase

async function ensureBucketExists() {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) throw error;

    const bucketExists = buckets.some(b => b.name === STORAGE_BUCKET);
    if (!bucketExists) {
        console.log(`🪣 Creating bucket: ${STORAGE_BUCKET}`);
        const { error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
            public: false, // Internal AI config
        });
        if (createError) throw createError;
    }
}

async function uploadFile(filePath, destinationPath) {
    try {
        const fullPath = path.join(ROOT_DIR, filePath);
        if (!fs.existsSync(fullPath)) {
            console.warn(`⚠️ Warning: File not found: ${filePath}`);
            return;
        }

        const fileBuffer = fs.readFileSync(fullPath);

        // Gunakan upsert agar file yang sudah ada ditimpa
        const { data, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(destinationPath, fileBuffer, {
                upsert: true,
                contentType: 'text/plain',
            });

        if (error) throw error;
        console.log(`✅ Uploaded: ${filePath} -> ${STORAGE_BUCKET}/${destinationPath}`);
    } catch (err) {
        console.error(`❌ Failed to upload ${filePath}:`, err.message);
    }
}

async function uploadDirectory(dirPath, destDir = '') {
    const fullDirPath = path.join(ROOT_DIR, dirPath);
    if (!fs.existsSync(fullDirPath)) return;

    const files = fs.readdirSync(fullDirPath);
    for (const file of files) {
        const filePath = path.join(fullDirPath, file);
        const relPath = path.join(dirPath, file);
        const destPath = path.posix.join(destDir, file);

        if (fs.statSync(filePath).isDirectory()) {
            await uploadDirectory(relPath, destPath);
        } else {
            await uploadFile(relPath, destPath);
        }
    }
}

async function syncVercelEnv() {
    console.log('🔄 Triggering Vercel deployment/env check...');
    try {
        // Memastikan vercel CLI tersedia. 
        // Ini mengasumsikan user telah melakukan vercel login sebelumnya.
        console.log('Verifikasi Vercel CLI (Membutuhkan instalasi & login Vercel lokal)');
        const vercelVersion = execSync('npx vercel --version', { encoding: 'utf-8', stdio: 'pipe' });
        console.log(`Vercel CLI v${vercelVersion.trim()} active.`);

        // Contoh command: `npx vercel env pull .env.local`
        // Namun untuk push local to cloud, kita butuh eksekusi manual per key 
        // atau menggunakan vercel commands.
        console.log('✅ Vercel automation hook ready. Gunakan `npx vercel` untuk mendeploy terbaru.');
    } catch (err) {
        console.warn('⚠️ Vercel CLI tidak terdeteksi atau error. Abaikan jika Vercel terhubung via Git.');
    }
}

async function main() {
    console.log('🛡️ Ecosystem Sentinel - Cloud Sync Protocol Initiated');

    try {
        await ensureBucketExists();

        console.log('\n📤 Uploading .cursorrules...');
        await uploadFile('.cursorrules', '.cursorrules');

        console.log('\n📤 Uploading .agents/ directory...');
        await uploadDirectory('.agents', '.agents');

        console.log('\n🌐 Syncing Vercel Infrastructure...');
        await syncVercelEnv();

        console.log('\n✅ Cloud Sync Complete.');
    } catch (e) {
        console.error('❌ Sync Failed:', e);
        process.exit(1);
    }
}

main();
