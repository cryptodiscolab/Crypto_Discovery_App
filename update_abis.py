import os
import json

def update_abis():
    artifacts_dir = "e:/Disco Gacha/Disco_DailyApp/artifacts/contracts"
    output_file = "e:/Disco Gacha/Disco_DailyApp/Raffle_Frontend/src/lib/abis_data.txt"
    
    contracts = {
        "MASTER_X": "CryptoDiscoMasterX.sol/CryptoDiscoMasterX.json",
        "DAILY_APP": "DailyAppV12Secured.sol/DailyAppV12Secured.json",
        "RAFFLE": "CryptoDiscoRaffle.sol/CryptoDiscoRaffle.json",
        "CONTENT_CMS": "ContentCMSV2.sol/ContentCMSV2.json"
    }
    
    with open(output_file, "w") as f:
        for key, path in contracts.items():
            full_path = os.path.join(artifacts_dir, path)
            if os.path.exists(full_path):
                with open(full_path, "r") as cf:
                    data = json.load(cf)
                    abi = data.get("abi", [])
                    f.write(f"{key}_ABI = {json.dumps(abi)}\n\n")
                    print(f"Updated {key} ABI")
            else:
                print(f"File not found: {full_path}")

if __name__ == "__main__":
    update_abis()
