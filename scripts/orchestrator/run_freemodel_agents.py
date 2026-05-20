#!/usr/bin/env python3
import os
import sys
import time

# Fix Windows console encoding for emoji/unicode characters
if sys.platform.startswith('win'):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Ensure root directory is in sys.path to import antigravity_sdk correctly
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, '../../'))
sys.path.insert(0, root_dir)

from antigravity_sdk import ResearchBot, CodeBot, run_parallel

def main():
    print("==========================================")
    print("🤖 FREEMODEL SUB-AGENTS ORCHESTRATION DEMO")
    print("==========================================")

    # Prepare parallel tasks
    tasks = [
        (ResearchBot, "Analyze gas optimization strategies for Solidity contracts focusing on SSTORE/SLOAD. Provide a brief 3-bullet list."),
        (CodeBot, "Write a basic Solidity ERC20 contract called 'DiscoToken' that allows users to burn tokens up to 10% of total supply. Keep it under 25 lines.")
    ]

    print("\n⏳ Launching parallel execution on ResearchBot and CodeBot in the background...")
    start_time = time.time()
    results = run_parallel(tasks)
    duration = time.time() - start_time
    print(f"✅ Both agents completed in {duration:.2f} seconds.")

    print("\n==========================================")
    print("🔬 [ResearchBot Output]")
    print("==========================================")
    print(results[0])

    print("\n==========================================")
    print("💻 [CodeBot Output]")
    print("==========================================")
    print(results[1])
    print("==========================================")

if __name__ == "__main__":
    main()
