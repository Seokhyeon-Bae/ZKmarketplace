const hre = require("hardhat");

async function main() {
  console.log("Deploying ZK Marketplace...");

  // Get the contract factory
  const ZKMarketplace = await hre.ethers.getContractFactory("ZKMarketplace");
  
  // Deploy the contract
  // The fee recipient will be the deployer for now
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  const marketplace = await ZKMarketplace.deploy(deployer.address);
  await marketplace.waitForDeployment();

  const marketplaceAddress = await marketplace.getAddress();
  console.log("ZK Marketplace deployed to:", marketplaceAddress);
  
  // Verify deployment
  console.log("Verifying deployment...");
  const platformFee = await marketplace.platformFeePercent();
  const feeRecipient = await marketplace.feeRecipient();
  
  console.log("Platform fee:", platformFee.toString(), "basis points");
  console.log("Fee recipient:", feeRecipient);
  
  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: marketplaceAddress,
    deployer: deployer.address,
    platformFee: platformFee.toString(),
    feeRecipient: feeRecipient,
    timestamp: new Date().toISOString()
  };
  
  console.log("Deployment completed successfully!");
  console.log("Deployment info:", JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
