const hre = require("hardhat");

async function main() {
  console.log("🔐 Deploying PERMISSIONED ZK Marketplace...\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying from account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString(), "\n");

  // Deploy the permissioned contract
  console.log("📝 Deploying ZKMarketplace_Permissioned...");
  const ZKMarketplace = await hre.ethers.getContractFactory("ZKMarketplace_Permissioned");
  const marketplace = await ZKMarketplace.deploy(deployer.address);

  await marketplace.deployed();

  console.log("✅ Contract deployed to:", marketplace.address);
  console.log("📊 Contract details:");
  console.log("   - Owner:", await marketplace.owner());
  console.log("   - Fee Recipient:", await marketplace.feeRecipient());
  console.log("   - Platform Fee:", await marketplace.platformFeePercent(), "basis points (2.5%)");
  console.log("   - Total Approved Sellers:", (await marketplace.totalApprovedSellers()).toString());
  console.log("   - Total Approved Buyers:", (await marketplace.totalApprovedBuyers()).toString());
  
  // Verify deployer is auto-approved
  const deployerIsApprovedSeller = await marketplace.isApprovedSeller(deployer.address);
  const deployerIsApprovedBuyer = await marketplace.isApprovedBuyer(deployer.address);
  console.log("\n🔑 Deployer Permissions:");
  console.log("   - Approved Seller:", deployerIsApprovedSeller);
  console.log("   - Approved Buyer:", deployerIsApprovedBuyer);

  // Example: Approve some test addresses (optional)
  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    console.log("\n👥 Approving test accounts...");
    
    const testAccounts = await hre.ethers.getSigners();
    const addressesToApprove = testAccounts.slice(1, 4).map(acc => acc.address); // Approve accounts 1-3
    
    if (addressesToApprove.length > 0) {
      console.log("   Approving as sellers and buyers:", addressesToApprove);
      
      for (const addr of addressesToApprove) {
        const tx = await marketplace.approveParticipant(addr);
        await tx.wait();
        console.log(`   ✅ Approved: ${addr}`);
      }
      
      console.log("\n📊 Updated Statistics:");
      console.log("   - Total Approved Sellers:", (await marketplace.totalApprovedSellers()).toString());
      console.log("   - Total Approved Buyers:", (await marketplace.totalApprovedBuyers()).toString());
    }
  }

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: marketplace.address,
    deployer: deployer.address,
    platformFee: (await marketplace.platformFeePercent()).toString(),
    feeRecipient: await marketplace.feeRecipient(),
    timestamp: new Date().toISOString(),
    type: "PERMISSIONED",
    approvedSellers: (await marketplace.totalApprovedSellers()).toString(),
    approvedBuyers: (await marketplace.totalApprovedBuyers()).toString()
  };

  console.log("\n" + "=".repeat(60));
  console.log("🎉 PERMISSIONED MARKETPLACE DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📋 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  
  console.log("\n⚠️  IMPORTANT NOTES:");
  console.log("   1. This is a PERMISSIONED marketplace");
  console.log("   2. Only approved addresses can create/fund orders");
  console.log("   3. Use approveSeller() and approveBuyer() to add users");
  console.log("   4. Update your .env files with the new contract address:");
  console.log(`      CONTRACT_ADDRESS=${marketplace.address}`);
  console.log(`      NEXT_PUBLIC_CONTRACT_ADDRESS=${marketplace.address}`);
  
  console.log("\n🔧 Admin Functions Available:");
  console.log("   - approveSeller(address)");
  console.log("   - approveBuyer(address)");
  console.log("   - approveParticipant(address) - both roles");
  console.log("   - batchApproveSellers(address[])");
  console.log("   - batchApproveBuyers(address[])");
  console.log("   - revokeSeller(address)");
  console.log("   - revokeBuyer(address)");
  
  console.log("\n📚 Next Steps:");
  console.log("   1. Update environment variables");
  console.log("   2. Restart your backend indexer");
  console.log("   3. Update frontend contract address");
  console.log("   4. Create admin panel for user approvals");
  console.log("   5. Start approving users!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


