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
        // PROTOKOL: WAJIB DARI DB, DILARANG HARDCODED/ENV
        const [userRes, pointRes] = await Promise.all([
            supabase.from('user_stats').select('*').eq('fid', fid).single(),
            supabase.from('point_settings')
                .select('points_value')
                .eq('activity_key', 'daily_login')
                .eq('is_active', true) // Hanya ambil jika aktif
                .single()
        ]);

        // Validasi Error - Jika setting poin tidak ada/tidak aktif, proses berhenti.
        if (userRes.error && userRes.error.code !== 'PGRST116') throw userRes.error;
        if (pointRes.error || !pointRes.data) {
            console.error('[Security] Konfigurasi poin "daily_login" tidak ditemukan atau tidak aktif di DB.');
            throw new Error("Sistem poin sedang dalam pemeliharaan (DB missing/inactive).");
        }

        const userData = userRes.data || { fid, total_xp: 0, current_level: 1, last_login_at: null };
        const poinHadiah = pointRes.data.points_value;

        // STEP B: Cek Cooldown
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
        // Ambil level tertinggi yang min_xp nya <= total XP baru
        const { data: thresholds, error: tError } = await supabase
            .from('sbt_thresholds')
            .select('level, tier_name') // Menggunakan tier_name sesuai SQL patch terbaru
            .lte('min_xp', totalXpTerbaru)
            .order('min_xp', { ascending: false })
            .limit(1);

        if (tError) throw tError;

        // DILARANG Hardcoded Level, jika tidak ada di DB maka default ke level 1
        const infoLevel = thresholds[0] || { level: 1, tier_name: 'Disco Starter' };
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

        return {
            success: true,
            message: apakahNaikLevel ? `🎉 GG! Lu NAIK KE LEVEL ${infoLevel.tier_name}!` : `✅ Berhasil claim ${poinHadiah} poin!`,
            data: {
                poin_didapat: poinHadiah,
                total_xp: totalXpTerbaru,
                level: levelTerbaru,
                nama_level: infoLevel.tier_name,
                is_levelup: apakahNaikLevel
            }
        };

    } catch (err) {
        console.error('[Error System]', err.message);
        return { success: false, error: err.message || 'Database error logic.' };
    }
}
