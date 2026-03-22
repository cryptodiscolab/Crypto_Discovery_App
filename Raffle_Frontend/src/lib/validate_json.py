import json
import sys

abi_file = r"e:\Disco Gacha\Disco_DailyApp\Raffle_Frontend\src\lib\abis_data.txt"

try:
    with open(abi_file, "r") as f:
        data = json.load(f)
        print("JSON is Valid")
except Exception as e:
    print(f"JSON is Invalid: {e}")
    sys.exit(1)
