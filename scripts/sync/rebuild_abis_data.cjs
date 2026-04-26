/**
 * Rebuild abis_data.txt — inject DAILY_APP ABI from daily_app_abi.json
 * This script replaces the DAILY_APP section in abis_data.txt with
 * the complete ABI from daily_app_abi.json.
 */
const fs = require('fs');
const path = require('path');

const LIB = path.join(__dirname, '..', '..', 'Raffle_Frontend', 'src', 'lib');

// Read files (handle both UTF-8 and UTF-16LE)
function readFileAuto(filePath) {
    const buf = fs.readFileSync(filePath);
    // Check for UTF-16LE BOM
    if (buf[0] === 0xFF && buf[1] === 0xFE) {
        return buf.toString('utf16le').replace(/^\uFEFF/, '');
    }
    // Check for UTF-8 BOM
    if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
        return buf.toString('utf8').replace(/^\uFEFF/, '');
    }
    return buf.toString('utf8');
}

// 1. Read the full DailyApp ABI
const dailyAbiRaw = readFileAuto(path.join(LIB, 'daily_app_abi.json'));
const dailyAbi = JSON.parse(dailyAbiRaw);
console.log(`✅ Loaded daily_app_abi.json: ${dailyAbi.length} entries`);

// List key functions we need
const neededFunctions = [
    'addTask', 'addTaskBatch', 'setTaskActive', 'setSponsorshipParams',
    'buySponsorshipWithToken', 'totalSponsorRequests', 'nextTaskId',
    'tasks', 'sponsorRequests', 'sponsorshipPlatformFee', 'tokenPriceUSD',
    'minRewardPoolValue', 'rewardPerClaim', 'doTask', 'setTokenPriceUSD',
    'autoApproveSponsorship', 'setAutoApproveSponsorship',
    'approveSponsorship', 'rejectSponsorship',
    'markTaskAsVerified', 'isTaskVerified', 'taskVerified',
    'hasCompletedTask', 'userStats', 'claimDailyBonus', 'claimRewards',
    'claimableRewards', 'adminSetTaskActive', 'adminCreateSponsorship',
    'setGlobalRewards', 'setSponsorshipPlatformFee', 'setCreatorToken',
    'setUSDCToken', 'setSponsorDuration', 'setWithdrawalFee',
    'setAllowedToken', 'allowedPaymentTokens',
    'userSponsorshipProgress', 'unsyncedPoints', 'syncMasterXPoints',
    'setMasterX', 'doBatchTasks', 'renewSponsorship',
    'dailyBonusAmount', 'sponsorDuration', 'withdrawalFeeBP',
    'tasksForReward', 'baseReferralReward', 'rewardPerClaim'
];

const foundFunctions = dailyAbi
    .filter(e => e.type === 'function')
    .map(e => e.name);

const missing = neededFunctions.filter(f => !foundFunctions.includes(f));
if (missing.length > 0) {
    console.warn(`⚠️  Functions not in daily_app_abi.json: ${missing.join(', ')}`);
} else {
    console.log(`✅ All ${neededFunctions.length} needed functions found in ABI`);
}

// 2. Read abis_data.txt
const abisDataRaw = readFileAuto(path.join(LIB, 'abis_data.txt'));
const abisData = JSON.parse(abisDataRaw);
console.log(`✅ Loaded abis_data.txt, keys: ${Object.keys(abisData.ABIS || abisData).join(', ')}`);

// 3. Replace the DAILY_APP section
if (abisData.ABIS) {
    const oldLen = (abisData.ABIS.DAILY_APP || []).length;
    abisData.ABIS.DAILY_APP = dailyAbi;
    console.log(`✅ Replaced DAILY_APP: ${oldLen} → ${dailyAbi.length} entries`);
} else {
    console.error('❌ Unexpected abis_data.txt structure — missing ABIS key');
    process.exit(1);
}

// 4. Write back as UTF-8 (no BOM — Vite ?raw expects UTF-8)
const output = JSON.stringify(abisData, null, 2);
fs.writeFileSync(path.join(LIB, 'abis_data.txt'), output, 'utf8');
console.log(`✅ Written abis_data.txt (${(output.length / 1024).toFixed(1)} KB)`);

// 5. Verify
const verify = JSON.parse(fs.readFileSync(path.join(LIB, 'abis_data.txt'), 'utf8'));
const verifyNames = (verify.ABIS.DAILY_APP || [])
    .filter(e => e.type === 'function')
    .map(e => e.name);
const stillMissing = neededFunctions.filter(f => !verifyNames.includes(f));
if (stillMissing.length > 0) {
    console.warn(`⚠️  Post-write verification — still missing: ${stillMissing.join(', ')}`);
} else {
    console.log(`✅ Verification passed: all ${neededFunctions.length} functions present in output`);
}
