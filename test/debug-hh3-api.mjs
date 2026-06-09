import { describe, it } from "node:test";

describe("Debug HH3 API", function () {
    it("should discover network connection", async function () {
        // Try various ways to access the network
        console.log("globalThis keys:", Object.keys(globalThis).filter(k => !k.startsWith("_")).join(", "));
        console.log("globalThis.network:", typeof globalThis.network);
        console.log("globalThis.hre:", typeof globalThis.hre);
        console.log("globalThis.ethers:", typeof globalThis.ethers);
        console.log("globalThis.connection:", typeof globalThis.connection);
        
        // Try to find any Hardhat-related globals
        for (const key of Object.getOwnPropertyNames(globalThis)) {
            const val = globalThis[key];
            if (val && typeof val === "object" && val !== null && (val.network || val.ethers)) {
                console.log(`Found HH-related global: ${key}`, Object.keys(val).join(", "));
            }
        }
        
        console.log("All globalThis keys:", Object.getOwnPropertyNames(globalThis).join(", "));
    });
});