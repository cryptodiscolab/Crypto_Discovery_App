#!/usr/bin/env python3
import os
import sys
import time
import json
import urllib.request
import urllib.error

# Ensure root directory is in sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, '../../'))
sys.path.insert(0, root_dir)

from antigravity_sdk import SUB_AGENTS_REGISTRY, save_agent_task

def fetch_pending_task():
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SECRET_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not supabase_url or not service_role_key:
        return None
        
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json"
    }
    
    # Query for 1 pending task ordered by created_at ascending (FIFO)
    url = f"{supabase_url.rstrip('/')}/rest/v1/agents_vault?status=eq.pending&order=created_at.asc&limit=1"
    
    try:
        import ssl
        context = ssl._create_unverified_context()
        req = urllib.request.Request(url, headers=headers, method='GET')
        with urllib.request.urlopen(req, context=context) as response:
            res_body = response.read().decode('utf-8')
            tasks = json.loads(res_body)
            if tasks:
                return tasks[0]
    except Exception as e:
        print(f"[!] Warning: failed to fetch pending tasks: {e}")
    return None

def main():
    print("==========================================")
    print("🛰️  NEXUS LOCAL AGENT RUNNER STARTED")
    print("==========================================")
    print(f"Registered agents: {', '.join(SUB_AGENTS_REGISTRY.keys())}")
    print("Waiting for pending dispatches in agents_vault...")
    
    while True:
        try:
            task = fetch_pending_task()
            if task:
                task_id = task['id']
                task_name = task['task_name']
                task_desc = task.get('task_description', '')
                target_agent_name = task['target_agent']
                
                print(f"\n⚡ Processing Task: {task_name} (ID: {task_id}) for agent {target_agent_name}")
                
                # Check if target agent exists in registry
                # Standardize casing to find the correct agent
                agent = None
                for key in SUB_AGENTS_REGISTRY.keys():
                    if key.lower() == target_agent_name.lower():
                        agent = SUB_AGENTS_REGISTRY[key]
                        break
                        
                if not agent:
                    err_msg = f"Target agent '{target_agent_name}' not found in registry."
                    print(f"❌ {err_msg}")
                    save_agent_task(
                        task_id=task_id,
                        task_name=task_name,
                        task_description=task_desc,
                        target_agent=target_agent_name,
                        status="failed",
                        output_data={"error": err_msg}
                    )
                else:
                    try:
                        # Execution starts - ask will log 'processing' and eventually 'completed'/'failed'
                        # We pass task_id so it updates the same record instead of creating a new one!
                        agent.ask(task_desc, task_id=task_id)
                        print(f"✅ Finished Task: {task_name}")
                    except Exception as ex:
                        err_msg = f"Runtime Exception: {str(ex)}"
                        print(f"❌ {err_msg}")
                        save_agent_task(
                            task_id=task_id,
                            task_name=task_name,
                            task_description=task_desc,
                            target_agent=target_agent_name,
                            status="failed",
                            output_data={"error": err_msg}
                        )
            
        except Exception as e:
            print(f"[!] Loop Exception: {e}")
            
        time.sleep(3)

if __name__ == "__main__":
    main()
