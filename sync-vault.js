require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Mohon pastikan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY terisi di .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncToVault() {
    console.log('🔄 Memulai Sinkronisasi Knowledge ke Agent Vault...\n');

    let successCount = 0;

    // 1. Sync Cursorrules (Protocol)
    try {
        const rulesPath = path.join(__dirname, '.cursorrules');
        if (fs.existsSync(rulesPath)) {
            const content = fs.readFileSync(rulesPath, 'utf8');
            const { error } = await supabase.from('agent_vault').upsert({
                file_path: '.cursorrules',
                content: content,
                category: 'protocol',
                version: 1,
                updated_at: new Date().toISOString()
            }, { onConflict: 'file_path' });

            if (error) throw error;
            console.log('✅ Berhasil sync: .cursorrules (protocol)');
            successCount++;
        } else {
            console.log('⚠️ File .cursorrules tidak ditemukan.');
        }
    } catch (err) {
        console.error('❌ Gagal sync .cursorrules:', err.message);
    }

    // 2. Sync All Skills
    const skillsDir = path.join(__dirname, '.agents', 'skills');
    if (fs.existsSync(skillsDir)) {
        const skillFolders = fs.readdirSync(skillsDir);
        for (const folder of skillFolders) {
            const skillPath = path.join(skillsDir, folder, 'SKILL.md');
            if (fs.existsSync(skillPath)) {
                try {
                    const content = fs.readFileSync(skillPath, 'utf8');
                    const { error } = await supabase.from('agent_vault').upsert({
                        file_path: `skills/${folder}/SKILL.md`,
                        content: content,
                        category: 'skill',
                        version: 1,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'file_path' });

                    if (error) throw error;
                    console.log(`✅ Berhasil sync: skills/${folder}/SKILL.md`);
                    successCount++;
                } catch (err) {
                    console.error(`❌ Gagal sync skill ${folder}:`, err.message);
                }
            }
        }
    } else {
        console.log('⚠️ Folder .agents/skills tidak ditemukan.');
    }

    console.log(`\n🎉 Sinkronisasi selesai! Total ${successCount} dokumen berhasil dimuat ke otak "Lurah Ekosistem".`);
    process.exit(0);
}

syncToVault();
