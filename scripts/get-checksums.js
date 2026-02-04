const { ethers } = require("ethers");

const airnodeAddress = "0xa0AD79D995DdeeB18a14eAef56A549A04e3Aa1Bd";
const priceFeedAddress = "0x4aDC43E4F3841847BB1479f4a079CF294975267D";

console.log("Correct Checksummed Addresses:");
console.log("Airnode RRP:", ethers.getAddress(airnodeAddress));
console.log("Price Feed:", ethers.getAddress(priceFeedAddress));
