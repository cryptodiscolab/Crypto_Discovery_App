import json
import sys

abi_file = r"e:\Disco Gacha\Disco_DailyApp\Raffle_Frontend\src\lib\abis_data.txt"

try:
    with open(abi_file, "r") as f:
        data = json.load(f)
        
    daily_app_abi = data["ABIS"]["DAILY_APP"]
    
    missing_funcs = [
        {
            "inputs": [
                {
                    "internalType": "enum DailyAppV12Secured.SponsorLevel",
                    "name": "_level",
                    "type": "uint8"
                },
                {
                    "internalType": "string[]",
                    "name": "_titles",
                    "type": "string[]"
                },
                {
                    "internalType": "string[]",
                    "name": "_links",
                    "type": "string[]"
                },
                {
                    "internalType": "string",
                    "name": "_email",
                    "type": "string"
                }
            ],
            "name": "adminCreateSponsorship",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "_taskId",
                    "type": "uint256"
                },
                {
                    "internalType": "bool",
                    "name": "_active",
                    "type": "bool"
                }
            ],
            "name": "adminSetTaskActive",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "_bronze",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "_silver",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "_gold",
                    "type": "uint256"
                }
            ],
            "name": "setPackagePricesUSD",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256[3]",
                    "name": "_prices",
                    "type": "uint256[3]"
                }
            ],
            "name": "setPackagePricesUSD",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ]
    
    # Check if they exist to avoid duplicates
    existing_names = [item.get("name") for item in daily_app_abi if "name" in item]
    
    added = 0
    for func in missing_funcs:
        # For overloaded functions, simple name check isn't enough, but since neither exists here, we just add them
        if func["name"] not in existing_names or func["name"] == "setPackagePricesUSD":
            # Just manually double check if the specific overload exists
            exists = False
            for existing in daily_app_abi:
                if existing.get("name") == func["name"] and len(existing.get("inputs", [])) == len(func["inputs"]):
                    exists = True
                    break
            if not exists:
                daily_app_abi.append(func)
                added += 1

    if added > 0:
        with open(abi_file, "w") as f:
            json.dump(data, f, indent=4)
        print(f"Added {added} missing ABI items for DAILY_APP.")
    else:
        print("No missing items needed to be added.")

except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
