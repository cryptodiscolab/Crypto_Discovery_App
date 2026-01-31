require('dotenv').config();

module.exports = {
  // API Keys
  neynar: {
    apiKey: process.env.NEYNAR_API_KEY,
  },

  twitter: {
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
    bearerToken: process.env.TWITTER_BEARER_TOKEN,
  },

  // Blockchain
  blockchain: {
    contractAddress: process.env.CONTRACT_ADDRESS,
    verifierPrivateKey: process.env.VERIFIER_PRIVATE_KEY,
    rpcUrl: process.env.RPC_URL,
    chainId: parseInt(process.env.CHAIN_ID || '11155111'),
  },

  // Server
  server: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // Security
  security: {
    jwtSecret: process.env.JWT_SECRET,
    apiSecret: process.env.API_SECRET, // NEW: Secure header key
    rateLimit: parseInt(process.env.RATE_LIMIT || '10'),
  },
};
