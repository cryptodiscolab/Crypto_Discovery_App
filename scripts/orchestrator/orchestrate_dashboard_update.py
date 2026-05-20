#!/usr/bin/env python3
import os
import sys
import re

# Fix Windows console encoding for emoji/unicode characters
if sys.platform.startswith('win'):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Ensure root directory is in sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, '../../'))
sys.path.insert(0, root_dir)

from antigravity_sdk import OrchestratorBot

def main():
    print("==================================================")
    print("🛰️  STARTING ORCHESTRATOR LIVE DASHBOARD CREATION")
    print("==================================================")

    prompt = """
Write a completely updated React dashboard for `Raffle_Frontend/src/features/admin/components/tabs/NexusMonitorTab.tsx`.
You must delegate the task of writing this React dashboard code to FrontendBot using the delegation tag:
[DELEGATE: FrontendBot -> Write the React dashboard code based on the following instructions...]

Instructions for FrontendBot:
1. It must implement the 12 agents list at the top.
2. Clicking on an agent card must toggle filtering: if clicked, it filters the task list below to only show tasks where target_agent equals that agent.
3. The task feed must render a real-time hierarchical tree of tasks. Add visual vertical connection lines between parent nodes and child nodes, so it clearly shows the delegation flow (e.g., border-l border-white/10, dot icons, left-padding).
4. Include a status overview at the top with metrics: Total Tasks, Completed, Failed, Processing, and a nice visual progress bar showing completion percentage.
5. Make the "Output Log" collapsible/expandable (accordion) to avoid clutter, with a copy button.
6. Design with glassmorphic styles adhering to the "Midnight Cyber" guidelines (bg-white/5, backdrop-blur-xl, border-white/5, text-[11px] font-black uppercase for labels, etc.).
7. Maintain the "Execute Dispatch" form allowing administrators to dispatch new tasks to any agent. The submit button must use `bg-indigo-600/20`, `border-indigo-500/30`, and `text-indigo-400` with no decorative icons (Zap/Ticket), exactly matching Rule 55.
8. Make it fully type-safe and resolve any potential TS implicit any errors.

Once FrontendBot returns the code, you (OrchestratorBot) must inspect the code. Make sure it contains no placeholders, has all imports, and is completely valid TypeScript/React. If yes, reply ONLY with the code wrapped in standard ```tsx and ``` markdown code blocks.
"""

    print("Sending instructions to OrchestratorBot...")
    result = OrchestratorBot.ask(prompt)
    print("\nOrchestratorBot Finished. Extracting TSX code block...")

    # Find TSX code block
    match = re.search(r'```tsx\s*([\s\S]+?)\s*```', result)
    if not match:
        # Try raw code without markdown backticks if it didn't use them
        if "import " in result and "export " in result:
            code = result
        else:
            print("❌ Error: Could not find valid TSX code block in Orchestrator's response.")
            print("Response output was:")
            print(result)
            return
    else:
        code = match.group(1)

    output_file = os.path.join(root_dir, 'Raffle_Frontend/src/features/admin/components/tabs/NexusMonitorTab.tsx')
    print(f"Writing updated dashboard to {output_file}...")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(code)
        
    print("✅ Dashboard successfully updated via Orchestrator delegation!")

if __name__ == "__main__":
    main()
