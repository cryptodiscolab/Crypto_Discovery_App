#!/bin/bash
# wsl-exec.sh - Helper script to execute project commands in WSL with correct environment

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Load NVM
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
else
    echo "❌ Error: NVM not found at $NVM_DIR"
    exit 1
fi

# Use the correct Node version
nvm use 23.6.0 > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "⚠️ Warning: Node 23.6.0 not found, trying to install..."
    nvm install 23.6.0 > /dev/null 2>&1
    nvm use 23.6.0 > /dev/null
fi

# Execute the passed arguments
if [ $# -eq 0 ]; then
    echo "Usage: ./wsl-exec.sh <command>"
    exit 1
fi

# Log execution for traceability
# echo "🚀 WSL Executing: $@"

"$@"
