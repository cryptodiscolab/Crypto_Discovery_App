import { createClient } from '@supabase/supabase-js';

// ==========================================
// 1. INISIALISASI (Koneksi ke Supabase)
// Menggunakan variabel dari file .env lu
// ==========================================
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Kalo lu jalanin ini di server (Project IDX), disarankan pake Service Role Key
// tapi kalo di Frontend, Anon Key sudah cukup.
export const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// 2. LOGIC FUNCTION (Mesin Daily Claim)
// ==========================================
/**
 * handleDailyClaim: Mengatur claim harian, poin, dan naik level.
 * @param {number} fid - Farcaster ID User
 */
export async function handleDailyClaim(fid) {
    const COOLDOWN_24H = 86400000; // 24 jam dalam milidetik

    try {
        console.log(`[System] Menjalankan claim harian untuk FID: ${fid}`);

        // STEP A: Ambil data user & setting poin secara bersamaan
        const [userRes, pointRes] = await Promise.all([
            supabase.from('user_stats').select('*').eq('fid', fid).single(),
            supabase.from('point_settings').select('points_value').eq('activity_key', 'daily_login').single()
        ]);

        // Validasi Error
        if (userRes.error && userRes.error.code !== 'PGRST116') throw userRes.error;
        if (pointRes.error || !pointRes.data) throw new Error("Pengaturan 'daily_login' tidak ditemukan di database.");

        const userData = userRes.data || { fid, total_xp: 0, current_level: 1, last_login_at: null };
        const poinHadiah = pointRes.data.points_value;

        // STEP B: Cek Cooldown (Apa sudah lewat 24 jam?)
        const waktuSekarang = new Date();
        if (userData.last_login_at) {
            const terakhirClaim = new Date(userData.last_login_at);
            const selisihWaktu = waktuSekarang.getTime() - terakhirClaim.getTime();

            if (selisihWaktu < COOLDOWN_24H) {
                const sisaMs = COOLDOWN_24H - selisihWaktu;
                const jam = Math.floor(sisaMs / (1000 * 60 * 60));
                const menit = Math.floor((sisaMs % (1000 * 60 * 60)) / (1000 * 60));
                return {
                    success: false,
                    message: `Sabar bor! Lu baru bisa claim lagi dalam ${jam} jam ${menit} menit.`
                };
            }
        }

        // STEP C: Hitung XP Baru
        const totalXpTerbaru = (userData.total_xp || 0) + poinHadiah;

        // STEP D: Cek Leveling (SBT Leveling Logic)
        // Mencari level tertinggi yang min_xp nya di bawah total XP baru user
        const { data: thresholds, error: tError } = await supabase
            .from('sbt_thresholds')
            .select('level, level_name')
            .lte('min_xp', totalXpTerbaru)
            .order('min_xp', { ascending: false })
            .limit(1);

        if (tError) throw tError;

        const infoLevel = thresholds[0] || { level: 1, level_name: 'Disco Starter' };
        const levelTerbaru = infoLevel.level;
        const apakahNaikLevel = levelTerbaru > userData.current_level;

        // STEP E: Simpan Permanen ke Database
        const { error: updateError } = await supabase
            .from('user_stats')
            .upsert({
                fid: fid,
                total_xp: totalXpTerbaru,
                current_level: levelTerbaru,
                last_login_at: waktuSekarang.toISOString()
            });

        if (updateError) throw updateError;

        // Hasil Akhir
        return {
            success: true,
            message: apakahNaikLevel ? `🎉 GG! Lu NAIK KE LEVEL ${infoLevel.level_name}!` : `✅ Berhasil claim ${poinHadiah} poin!`,
            data: {
                poin_didapat: poinHadiah,
                total_xp: totalXpTerbaru,
                level: levelTerbaru,
                nama_level: infoLevel.level_name,
                is_levelup: apakahNaikLevel
            }
        };

    } catch (err) {
        console.error('[Error System]', err.message);
        return { success: false, error: 'Database eror. Pastikan tabel sudah dibuat di Supabase.' };
    }
}
