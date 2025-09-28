const hre = require("hardhat");

async function main() {
  console.log("Deploying ZK Marketplace to Testnet...");

  // Get the contract factory
  const ZKMarketplace = await hre.ethers.getContractFactory("ZKMarketplace");
  const DisputeResolution = await hre.ethers.getContractFactory("DisputeResolution");
  
  // Deploy the contracts
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Deploy ZKMarketplace
  console.log("Deploying ZKMarketplace...");
  const marketplace = await ZKMarketplace.deploy(deployer.address);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("ZKMarketplace deployed to:", marketplaceAddress);

  // Deploy DisputeResolution
  console.log("Deploying DisputeResolution...");
  const disputeResolution = await DisputeResolution.deploy(marketplaceAddress, deployer.address);
  await disputeResolution.waitForDeployment();
  const disputeAddress = await disputeResolution.getAddress();
  console.log("DisputeResolution deployed to:", disputeAddress);
  
  // Verify deployment
  console.log("Verifying deployment...");
  const platformFee = await marketplace.platformFeePercent();
  const feeRecipient = await marketplace.feeRecipient();
  
  console.log("Platform fee:", platformFee.toString(), "basis points");
  console.log("Fee recipient:", feeRecipient);
  
  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contracts: {
      ZKMarketplace: {
        address: marketplaceAddress,
        abi: "ZKMarketplace.sol"
      },
      DisputeResolution: {
        address: disputeAddress,
        abi: "DisputeResolution.sol"
      }
    },
    deployer: deployer.address,
    platformFee: platformFee.toString(),
    feeRecipient: feeRecipient,
    timestamp: new Date().toISOString(),
    rpcUrl: hre.network.config.url,
    chainId: hre.network.config.chainId
  };
  
  console.log("Deployment completed successfully!");
  console.log("Deployment info:", JSON.stringify(deploymentInfo, null, 2));
  
  // Save to file for easy access
  const fs = require('fs');
  const deploymentFile = `deployments/${hre.network.name}-${Date.now()}.json`;
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Deployment info saved to: ${deploymentFile}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

