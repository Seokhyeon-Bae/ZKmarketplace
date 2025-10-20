const hre = require("hardhat");

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log("🚀 Deploying ZK Marketplace with Reputation System");
  console.log('='.repeat(60) + '\n');

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 Deploying from account:", deployer.address);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", balance.toString(), "wei\n");

  // Deploy the contract
  console.log("📄 Deploying contract...");
  const ZKMarketplace = await hre.ethers.getContractFactory("ZKMarketplace");
  const marketplace = await ZKMarketplace.deploy(deployer.address);
  await marketplace.waitForDeployment();
  
  const marketplaceAddress = await marketplace.getAddress();

  console.log("\n✅ Contract deployed successfully!");
  console.log("📍 Contract address:", marketplaceAddress);
  
  // Get contract configuration
  const platformFee = await marketplace.platformFeePercent();
  const feeRecipient = await marketplace.feeRecipient();
  const minRep = await marketplace.MINIMUM_SELLER_REPUTATION();
  const initialRep = await marketplace.INITIAL_REPUTATION();
  const repPerSuccess = await marketplace.REPUTATION_PER_SUCCESS();
  
  console.log("\n📊 Contract Configuration:");
  console.log("   Owner:", await marketplace.owner());
  console.log("   Fee Recipient:", feeRecipient);
  console.log("   Platform Fee:", platformFee.toString(), "basis points (2.5%)");
  console.log("   Minimum Seller Reputation:", minRep.toString());
  console.log("   Initial Reputation:", initialRep.toString());
  console.log("   Reputation per Success:", repPerSuccess.toString());
  
  // Verify deployer reputation
  const deployerRep = await marketplace.getUserReputation(deployer.address);
  console.log("\n🔑 Deployer Reputation:");
  console.log("   Score:", deployerRep.score.toString());
  console.log("   Verified:", deployerRep.isVerified);
  console.log("   Can Sell:", await marketplace.canUserSell(deployer.address));
  
  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: marketplaceAddress,
    deployer: deployer.address,
    platformFee: platformFee.toString(),
    feeRecipient: feeRecipient,
    timestamp: new Date().toISOString(),
    features: {
      reputationSystem: true,
      sellerVerification: true,
      creditScoreTracking: true,
      automaticReputationUpdate: true
    }
  };

  console.log('\n' + '='.repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log('='.repeat(60));
  console.log('\n📋 Deployment Summary:');
  console.log(JSON.stringify(deploymentInfo, null, 2));
  
  console.log('\n⚠️  NEXT STEPS:');
  console.log('');
  console.log('1. Update environment variables:');
  console.log(`   CONTRACT_ADDRESS=${marketplaceAddress}`);
  console.log('');
  console.log('2. Create backend/.env file:');
  console.log('   DB_HOST=localhost');
  console.log('   DB_PORT=5432');
  console.log('   DB_NAME=zk_marketplace');
  console.log('   DB_USER=postgres');
  console.log('   DB_PASSWORD=your_password');
  console.log(`   RPC_URL=${hre.network.config.url || 'http://127.0.0.1:8545'}`);
  console.log(`   CONTRACT_ADDRESS=${marketplaceAddress}`);
  console.log('   START_BLOCK=0');
  console.log('   PORT=3001');
  console.log('');
  console.log('3. Update frontend/.env.local:');
  console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS=${marketplaceAddress}`);
  console.log(`   NEXT_PUBLIC_RPC_URL=${hre.network.config.url || 'http://127.0.0.1:8545'}`);
  console.log('');
  console.log('4. Set up database:');
  console.log('   createdb zk_marketplace');
  console.log('   psql zk_marketplace < backend/schema.sql');
  console.log('');
  console.log('5. Install backend dependencies:');
  console.log('   cd backend && npm install');
  console.log('');
  console.log('6. Start backend services:');
  console.log('   Terminal 1: npm start        # API server on port 3001');
  console.log('   Terminal 2: npm run indexer  # Blockchain indexer');
  console.log('');
  console.log('7. Start frontend:');
  console.log('   cd frontend && npm run dev   # Frontend on port 3000');
  console.log('\n' + '='.repeat(60) + '\n');
  console.log('🎯 KEY FEATURES ENABLED:');
  console.log('   ✅ Reputation-based seller verification');
  console.log('   ✅ Automatic credit score calculation');
  console.log('   ✅ Blocks untrusted sellers (score < 0)');
  console.log('   ✅ Event-driven architecture for real-time sync');
  console.log('   ✅ Off-chain database integration');
  console.log('\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
