require('dotenv').config();

module.exports = {
  // API Keys
  neynar: {
    apiKey: process.env.NEYNAR_API_KEY?.trim(),
  },

  twitter: {
    apiKey: process.env.TWITTER_API_KEY?.trim(),
    apiSecret: process.env.TWITTER_API_SECRET?.trim(),
    accessToken: process.env.TWITTER_ACCESS_TOKEN?.trim(),
    accessSecret: process.env.TWITTER_ACCESS_SECRET?.trim(),
    bearerToken: process.env.TWITTER_BEARER_TOKEN?.trim(),
  },

  // Blockchain
  blockchain: {
    contractAddress: process.env.CONTRACT_ADDRESS?.trim(),
    verifierPrivateKey: process.env.VERIFIER_PRIVATE_KEY?.trim(),
    rpcUrl: process.env.RPC_URL?.trim(),
    chainId: parseInt(process.env.CHAIN_ID?.trim() || '84532'),
  },

  // Server
  server: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV?.trim() || 'development',
  },

  // Security
  security: {
    jwtSecret: process.env.JWT_SECRET?.trim(),
    apiSecret: process.env.API_SECRET?.trim(), // NEW: Secure header key
    rateLimit: parseInt(process.env.RATE_LIMIT || '10'),
  },
};
