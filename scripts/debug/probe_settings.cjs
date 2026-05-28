const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './Raffle_Frontend/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabase
        .from('system_settings')
        .select('*');
    if (error) {
        console.error("Error:", error);
    } else {
        const filtered = data.filter(d => 
            d.key.toLowerCase().includes('ref') || 
            d.key.toLowerCase().includes('url') || 
            d.key.toLowerCase().includes('link') || 
            d.key.toLowerCase().includes('farcaster') ||
            d.key.toLowerCase().includes('base')
        );
        console.log("Filtered Settings:", JSON.stringify(filtered, null, 2));
    }
}

main();
