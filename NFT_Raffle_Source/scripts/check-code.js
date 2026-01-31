const hre = require("hardhat");

async function main() {
    const address = "0xa0AD79D995DdeeB18a14eAef56A549A04e3Aa1Bd";
    const code = await hre.ethers.provider.getCode(address);
    console.log("Code at", address, ":", code === "0x" ? "EMPTY" : "EXISTS (" + code.length + " bytes)");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
Broadway
