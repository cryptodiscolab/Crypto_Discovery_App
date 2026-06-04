require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rbgzwhsdqnhwrwimjjfm.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
    console.error("❌ ERROR: SUPABASE_SERVICE_ROLE_KEY is missing from environment variables.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
    const { data: settings, error } = await supabase.from('system_settings').select('*');
    if (error) {
        console.error("Error fetching system_settings:", error);
    } else {
        console.log("System Settings in DB:");
        console.log(JSON.stringify(settings, null, 2));
    }
}

run();
