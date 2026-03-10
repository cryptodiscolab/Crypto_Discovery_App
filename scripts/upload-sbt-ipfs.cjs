const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const PINATA_JWT = process.env.PINATA_JWT;
const ARTIFACT_DIR = 'C:/Users/chiko/.gemini/antigravity/brain/10c3dcf4-4ff3-4fb6-baf5-25b04fa46b21';

async function uploadToIPFS(filePath, fileName) {
    const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
    let data = new FormData();
    data.append('file', fs.createReadStream(filePath));

    const metadata = JSON.stringify({
        name: fileName,
        keyvalues: {
            project: 'CryptoDisco',
            type: 'SBT'
        }
    });
    data.append('pinataMetadata', metadata);

    const options = JSON.stringify({
        cidVersion: 0,
    });
    data.append('pinataOptions', options);

    try {
        const res = await axios.post(url, data, {
            maxBodyLength: 'Infinity',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
                'Authorization': `Bearer ${PINATA_JWT}`
            }
        });
        return res.data.IpfsHash;
    } catch (error) {
        console.error(`Error uploading ${fileName}:`, error.response ? error.response.data : error.message);
        throw error;
    }
}

async function uploadMetadata(jsonData, fileName) {
    const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;
    
    const body = {
        pinataContent: jsonData,
        pinataMetadata: {
            name: fileName
        }
    };

    try {
        const res = await axios.post(url, body, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PINATA_JWT}`
            }
        });
        return res.data.IpfsHash;
    } catch (error) {
        console.error(`Error uploading metadata ${fileName}:`, error.response ? error.response.data : error.message);
        throw error;
    }
}

async function main() {
    if (!PINATA_JWT) {
        console.error('❌ Missing PINATA_JWT in .env');
        return;
    }

    const tiers = [
        { name: 'bronze', image: 'sbt_bronze_rookie_disc_1773086554206.png', metadata: 'metadata_bronze.json' },
        { name: 'silver', image: 'sbt_silver_star_shaper_1773088435643.png', metadata: 'metadata_silver.json' },
        { name: 'gold', image: 'sbt_gold_sun_weaver_1773088457172.png', metadata: 'metadata_gold.json' },
        { name: 'platinum', image: 'sbt_platinum_ether_ghost_1773088480280.png', metadata: 'metadata_platinum.json' },
        { name: 'diamond', image: 'sbt_diamond_disco_overlord_1773088500690.png', metadata: 'metadata_diamond.json' }
    ];

    console.log('🚀 Starting SBT IPFS Deployment...');

    const finalURIs = {};

    for (const tier of tiers) {
        console.log(`\n📦 Processing ${tier.name.toUpperCase()} Tier...`);
        
        // 1. Upload Image
        const imagePath = path.join(ARTIFACT_DIR, tier.image);
        console.log(`   📤 Uploading Image: ${tier.image}`);
        const imageHash = await uploadToIPFS(imagePath, tier.image);
        console.log(`   ✅ Image CID: ipfs://${imageHash}`);

        // 2. Read Metadata and update image URI
        const metadataPath = path.join(ARTIFACT_DIR, tier.metadata);
        const metadataRaw = fs.readFileSync(metadataPath, 'utf8');
        const metadataJson = JSON.parse(metadataRaw);
        metadataJson.image = `ipfs://${imageHash}`;

        // 3. Upload Metadata
        console.log(`   📤 Uploading Metadata: ${tier.metadata}`);
        const metadataHash = await uploadMetadata(metadataJson, tier.metadata);
        console.log(`   ✅ Metadata CID: ipfs://${metadataHash}`);

        finalURIs[tier.name] = `ipfs://${metadataHash}`;
    }

    console.log('\n✨ ALL ASSETS DEPLOYED TO IPFS ✨');
    console.log('====================================');
    console.log(JSON.stringify(finalURIs, null, 2));
    console.log('====================================');
    
    // Save final report
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'ipfs_deployment_report.json'), JSON.stringify(finalURIs, null, 2));
    console.log(`\n💾 Report saved to: ${path.join(ARTIFACT_DIR, 'ipfs_deployment_report.json')}`);
}

main();
