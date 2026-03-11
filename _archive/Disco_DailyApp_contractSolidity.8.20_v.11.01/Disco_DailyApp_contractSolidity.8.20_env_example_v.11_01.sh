# =============================================================================
# DailyAppV11 - Environment Variables
# =============================================================================
# Copy this file to .env and fill in your values
# NEVER commit .env to git!

# =============================================================================
# DEPLOYMENT CONFIGURATION
# =============================================================================

# Your deployer private key (KEEP THIS SECRET!)
PRIVATE_KEY=your_private_key_here

# Token contract address (ERC20 token for sponsorships)
TOKEN_ADDRESS=0x0000000000000000000000000000000000000000

# Initial owner address (should be multisig for production!)
INITIAL_OWNER=0x0000000000000000000000000000000000000000

# =============================================================================
# RPC ENDPOINTS
# =============================================================================

# Alchemy API Key (get from https://www.alchemy.com)
ALCHEMY_API_KEY=your_alchemy_api_key_here

# Ethereum Mainnet
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}

# Ethereum Sepolia Testnet
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}

# Polygon Mainnet
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}

# Polygon Mumbai Testnet
MUMBAI_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/${ALCHEMY_API_KEY}

# BSC Mainnet
BSC_RPC_URL=https://bsc-dataseed1.binance.org

# BSC Testnet
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545

# =============================================================================
# BLOCK EXPLORER API KEYS (for contract verification)
# =============================================================================

# Etherscan (get from https://etherscan.io/myapikey)
ETHERSCAN_API_KEY=your_etherscan_api_key_here

# Polygonscan (get from https://polygonscan.com/myapikey)
POLYGONSCAN_API_KEY=your_polygonscan_api_key_here

# BSCScan (get from https://bscscan.com/myapikey)
BSCSCAN_API_KEY=your_bscscan_api_key_here

# =============================================================================
# GAS REPORTING
# =============================================================================

# Enable gas reporting (true/false)
REPORT_GAS=false

# CoinMarketCap API Key (for USD gas prices)
COINMARKETCAP_API_KEY=your_coinmarketcap_api_key_here

# =============================================================================
# MONITORING & ALERTS
# =============================================================================

# Tenderly Project
TENDERLY_PROJECT=your_project_name
TENDERLY_USERNAME=your_username

# OpenZeppelin Defender
DEFENDER_TEAM_API_KEY=your_defender_team_api_key
DEFENDER_TEAM_API_SECRET_KEY=your_defender_team_api_secret_key

# =============================================================================
# SECURITY
# =============================================================================

# Bug Bounty Email
SECURITY_EMAIL=security@yourdomain.com

# Multisig Address (Gnosis Safe)
MULTISIG_ADDRESS=0x0000000000000000000000000000000000000000

# =============================================================================
# NOTES
# =============================================================================
# 
# TESTNET SETUP:
# 1. Get testnet ETH from faucets:
#    - Sepolia: https://sepoliafaucet.com
#    - Mumbai: https://faucet.polygon.technology
#    - BSC Testnet: https://testnet.binance.org/faucet-smart
#
# 2. Deploy mock ERC20 token first for testing
# 3. Set TOKEN_ADDRESS to your deployed token
# 4. Deploy DailyApp contract
#
# MAINNET SETUP:
# 1. Use hardware wallet or secure key management
# 2. Set INITIAL_OWNER to Gnosis Safe multisig
# 3. Ensure TOKEN_ADDRESS is correct production token
# 4. Double-check all configuration
# 5. Test on testnet first!
#
# SECURITY REMINDERS:
# - NEVER commit .env to git
# - NEVER share your PRIVATE_KEY
# - Use .gitignore to exclude .env
# - Use hardware wallet for mainnet deployments
# - Always use multisig for contract ownership
#
# =============================================================================
