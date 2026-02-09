const fs = require("fs");
const path = require("path");

const contracts = ["CryptoDiscoMaster", "DailyAppV12Secured", "ContentCMSV2", "MockRewardToken"];

contracts.forEach((name) => {
    try {
        const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", name + ".sol", name + ".json");
        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
        const size = artifact.deployedBytecode.length / 2 - 1; // Approx size in bytes
        console.log(`${name}: ${size} bytes (${(size / 1024).toFixed(2)} KB)`);
    } catch (e) {
        console.log(`${name}: Artifact not found`);
    }
});
