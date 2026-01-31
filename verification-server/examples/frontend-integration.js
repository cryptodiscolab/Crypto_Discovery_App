// Example: Frontend integration with verification system
// This shows how to integrate the verification API in your frontend

import { ethers } from 'ethers';

// Contract ABI (add to your project)
const DAILYAPP_ABI = [
    'function doTask(uint256 taskId, address referrer) external',
    'function isTaskVerified(address user, uint256 taskId) external view returns (bool)',
    'function canDoTask(address user, uint256 taskId) external view returns (bool, string)',
    'function getTask(uint256 taskId) external view returns (tuple(uint256 baseReward, bool isActive, uint256 cooldown, uint8 minTier, string title, string link, uint256 createdAt, bool requiresVerification))',
];

// Configuration
const CONTRACT_ADDRESS = '0x...'; // Your deployed contract
const VERIFICATION_API_URL = 'https://your-vercel-app.vercel.app';

// Initialize contract
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
const contract = new ethers.Contract(CONTRACT_ADDRESS, DAILYAPP_ABI, signer);

// ============================================================================
// FARCASTER VERIFICATION EXAMPLE
// ============================================================================

async function verifyFarcasterFollow(taskId, userFid, targetFid) {
    try {
        const userAddress = await signer.getAddress();

        // Call verification API
        const response = await fetch(`${VERIFICATION_API_URL}/api/verify/farcaster/follow`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userAddress,
                taskId,
                fid: userFid,
                targetFid,
            }),
        });

        const result = await response.json();

        if (result.success && result.verified) {
            console.log('✅ Verification successful!');
            console.log('Transaction hash:', result.txHash);
            return true;
        } else {
            console.error('❌ Verification failed:', result.error);
            return false;
        }
    } catch (error) {
        console.error('Error during verification:', error);
        return false;
    }
}

async function verifyFarcasterLike(taskId, userFid, castHash) {
    const userAddress = await signer.getAddress();

    const response = await fetch(`${VERIFICATION_API_URL}/api/verify/farcaster/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress, taskId, fid: userFid, castHash }),
    });

    return await response.json();
}

// ============================================================================
// TWITTER VERIFICATION EXAMPLE
// ============================================================================

async function verifyTwitterFollow(taskId, userId, targetUserId) {
    try {
        const userAddress = await signer.getAddress();

        const response = await fetch(`${VERIFICATION_API_URL}/api/verify/twitter/follow`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userAddress,
                taskId,
                userId,
                targetUserId,
            }),
        });

        const result = await response.json();

        if (result.success && result.verified) {
            console.log('✅ Twitter follow verified!');
            return true;
        } else {
            console.error('❌ Verification failed:', result.error);
            return false;
        }
    } catch (error) {
        console.error('Error during verification:', error);
        return false;
    }
}

async function verifyTwitterLike(taskId, userId, tweetId) {
    const userAddress = await signer.getAddress();

    const response = await fetch(`${VERIFICATION_API_URL}/api/verify/twitter/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress, taskId, userId, tweetId }),
    });

    return await response.json();
}

// ============================================================================
// COMPLETE TASK FLOW
// ============================================================================

async function completeTaskWithVerification(taskId, userFid, targetFid) {
    try {
        // 1. Get task info
        const task = await contract.getTask(taskId);
        console.log('Task:', task.title);
        console.log('Requires verification:', task.requiresVerification);

        // 2. Check if task requires verification
        if (task.requiresVerification) {
            console.log('📋 Task requires verification. Starting verification...');

            // 3. Verify the action (example: Farcaster follow)
            const verified = await verifyFarcasterFollow(taskId, userFid, targetFid);

            if (!verified) {
                alert('Verification failed. Please complete the required action first.');
                return;
            }

            // 4. Wait a bit for blockchain confirmation
            console.log('⏳ Waiting for verification to be confirmed on-chain...');
            await new Promise(resolve => setTimeout(resolve, 5000));

            // 5. Check verification status
            const userAddress = await signer.getAddress();
            const isVerified = await contract.isTaskVerified(userAddress, taskId);

            if (!isVerified) {
                alert('Verification not yet confirmed. Please wait a moment and try again.');
                return;
            }
        }

        // 6. Complete the task on smart contract
        console.log('🚀 Completing task on smart contract...');
        const tx = await contract.doTask(taskId, ethers.ZeroAddress);

        console.log('Transaction sent:', tx.hash);
        const receipt = await tx.wait();

        console.log('✅ Task completed successfully!');
        console.log('Gas used:', receipt.gasUsed.toString());

        alert('Task completed! Points awarded.');

    } catch (error) {
        console.error('Error completing task:', error);
        alert('Error: ' + error.message);
    }
}

// ============================================================================
// UI HELPER FUNCTIONS
// ============================================================================

async function checkTaskStatus(taskId) {
    const userAddress = await signer.getAddress();
    const [canDo, reason] = await contract.canDoTask(userAddress, taskId);

    if (canDo) {
        return { canComplete: true, message: 'Ready to complete!' };
    } else {
        return { canComplete: false, message: reason };
    }
}

async function getVerificationStatus(taskId) {
    const userAddress = await signer.getAddress();
    const isVerified = await contract.isTaskVerified(userAddress, taskId);
    return isVerified;
}

// ============================================================================
// EXAMPLE USAGE IN REACT COMPONENT
// ============================================================================

/*
function TaskCard({ task }) {
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleVerifyAndComplete = async () => {
    setVerifying(true);
    
    try {
      // Example: Farcaster follow task
      if (task.platform === 'farcaster' && task.action === 'follow') {
        await completeTaskWithVerification(
          task.id,
          userFid,        // User's Farcaster ID
          task.targetFid  // Target Farcaster ID to follow
        );
        setVerified(true);
      }
      
      // Example: Twitter like task
      if (task.platform === 'twitter' && task.action === 'like') {
        const verified = await verifyTwitterLike(
          task.id,
          userTwitterId,
          task.tweetId
        );
        
        if (verified.success) {
          // Wait for on-chain confirmation
          await new Promise(r => setTimeout(r, 5000));
          
          // Complete task
          const tx = await contract.doTask(task.id, ethers.ZeroAddress);
          await tx.wait();
          
          setVerified(true);
        }
      }
    } catch (error) {
      console.error(error);
      alert('Error: ' + error.message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="task-card">
      <h3>{task.title}</h3>
      <p>{task.description}</p>
      <p>Reward: {task.reward} points</p>
      
      {task.requiresVerification && (
        <p className="verification-badge">🔐 Requires Verification</p>
      )}
      
      <button 
        onClick={handleVerifyAndComplete}
        disabled={verifying || verified}
      >
        {verifying ? 'Verifying...' : verified ? '✅ Completed' : 'Complete Task'}
      </button>
    </div>
  );
}
*/

// ============================================================================
// EXPORT FOR USE IN YOUR APP
// ============================================================================

export {
    verifyFarcasterFollow,
    verifyFarcasterLike,
    verifyTwitterFollow,
    verifyTwitterLike,
    completeTaskWithVerification,
    checkTaskStatus,
    getVerificationStatus,
};
