
import subprocess
import os
import sys

# Set encoding for output to UTF-8
if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def clean_val_v2(val):
    if not val: return ""
    # Remove literal double quotes at the start and end of the string
    # Vercel env pull wraps the whole thing in quotes, so we check for internal quotes
    # e.g. val = '"0x..."' -> already clean (raw 0x...)
    # e.g. val = '""0x...""' -> corrupted (raw "0x...")
    
    # Strip any surrounding quotes first
    s = val.strip()
    if s.startswith('"') and s.endswith('"'):
        s = s[1:-1]
        
    # If it still starts/ends with quotes, it's a literal double quote corruption
    while s.startswith('"') and s.endswith('"'):
        s = s[1:-1]
        
    # Clean up any remaining escape characters or newlines
    s = s.replace('\\r', '').replace('\\n', '').replace('\r', '').replace('\n', '').strip()
    return s

def fix_env_v2(env_file_path, environment):
    print(f"\n[INFO] STAGE 2: Stripping literal quotes for {environment} from {env_file_path}...")
    if not os.path.exists(env_file_path):
        print(f"[ERROR] Sync file not found: {env_file_path}")
        return

    with open(env_file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    for line in lines:
        if line.startswith('#') or '=' not in line:
            continue
        
        parts = line.split('=', 1)
        key = parts[0].strip()
        raw_val = parts[1].strip()
        
        if key.startswith('VERCEL_') or key in ['VERCEL', 'DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_USER', 'POSTGRES_HOST', 'POSTGRES_PASSWORD', 'POSTGRES_DATABASE', 'TURBO_CACHE', 'NX_DAEMON']:
            continue

        clean = clean_val_v2(raw_val)
        
        # Pull wraps in one set of quotes. If there are more, it's corrupted.
        # Or if it contains any newline/escape stuff.
        # Example of raw pull: KEY="value"
        # Example of corruption: KEY=""value""
        is_corrupted = ('""' in raw_val) or ('\\r' in raw_val) or ('\\n' in raw_val)
        
        if is_corrupted:
            print(f"[*] Stripping quotes from {key}...")
            # Remove
            subprocess.run(['vercel', 'env', 'rm', key, environment, '--yes'], shell=True, capture_output=True)
            # Add back clean (no quotes in bash/cmd)
            subprocess.run(['vercel', 'env', 'add', key, environment], input=clean, text=True, shell=True, capture_output=True)
            print(f"  [OK] {key} restored as: {clean}")

base_path = r'e:\Disco Gacha\Disco_DailyApp\Raffle_Frontend'
fix_env_v2(os.path.join(base_path, '.env.vercel.production.check'), 'production')
# Also pull preview for checking
subprocess.run(['vercel', 'env', 'pull', '.env.vercel.preview.check', '--environment', 'preview', '--yes'], shell=True, cwd=base_path)
fix_env_v2(os.path.join(base_path, '.env.vercel.preview.check'), 'preview')

print("\n[FINISH] Stage 2 Global Cloud Purge Complete!")
