# Part 3: ZK Verification & Deployment Scripts

## 🔐 ZK Verification System (`/zk`)

### `/zk/verification.js`

**Purpose**: Zero-Knowledge verification stub - framework for future ZK proof integration.

---

### Class: `ZKVerification`

This is a **stub/mock implementation** that provides the structure for real ZK proofs in the future.

#### 1. **Core Concept**

Zero-Knowledge Proofs allow users to prove something is true without revealing the actual information.

**Example Use Cases**:
- Prove you're over 18 without showing your birthdate
- Prove you have good reputation without revealing transaction history
- Prove you meet requirements without exposing personal data

#### 2. **Current Implementation (Stub)**

```javascript
class ZKVerification {
  verifiedUsers: Set          // Stores verified user addresses
  verificationProofs: Map     // Stores proof details
}
```

**Key Methods**:

##### `verifyProof(proof, publicInputs)`
```javascript
// In real implementation, this would:
// 1. Verify the cryptographic proof
// 2. Check proof corresponds to public inputs
// 3. Validate proof hasn't expired
// 
// Current: Simulates verification (always returns true)
```

**Parameters**:
- `proof`: ZK proof data (in real impl: cryptographic proof)
- `publicInputs`: Public data that proof relates to
  - `userAddress`: User's Ethereum address
  - `requirements`: What they're proving
  - `timestamp`: When proof was generated

**Returns**: Boolean (true if valid)

##### `isUserVerified(userAddress)`
```javascript
// Checks if user has valid verification
// Returns false if:
// - No verification exists
// - Verification expired (24 hour TTL)
```

##### `generateMockProof(userAddress, requirements)`
```javascript
// For testing: Creates fake proof
// In production: Would use ZK proving system
```

##### `verifyUserRequirements(userAddress, requirements)`
```javascript
// Checks if user meets certain requirements
// In real implementation would:
// 1. Check on-chain history
// 2. Verify reputation scores
// 3. Check for disputes
// 4. Generate ZK proof of compliance
```

**Requirements Examples**:
```javascript
{
  minOrders: 5,           // At least 5 orders
  minReputation: 50,      // At least 50 reputation
  noDisputes: true,       // No open disputes
  accountAge: 30          // Account at least 30 days old
}
```

##### `getVerifiedUsers()`
Returns array of all verified user addresses

##### `revokeVerification(userAddress)`
Removes verification for a user (e.g., after dispute)

---

#### 3. **How It Will Work (Future Implementation)**

**Real ZK Proof System Integration**:

```
User Side:
1. User generates proof locally (using proving key)
   - Input: Private data (age, transaction history, etc.)
   - Computation: ZK circuit execution
   - Output: Proof + Public inputs

2. User submits proof to verification contract
   - Proof is compact (a few KB)
   - No private data revealed

Smart Contract:
3. Contract verifies proof on-chain
   - Uses verification key
   - Checks cryptographic validity
   - Validates in constant time

4. If valid: User marked as verified
   - Stored on-chain
   - Cannot be forged
   - Privacy preserved
```

**Technologies to Integrate**:
- **zk-SNARKs**: Succinct Non-interactive proofs (Groth16, PLONK)
- **zk-STARKs**: Transparent proofs (no trusted setup)
- **Circom**: Circuit language
- **SnarkJS**: JavaScript ZK library
- **Polygon Hermez**: ZK rollup integration

---

#### 4. **Use Cases in ZK Marketplace**

##### Identity Verification
```javascript
// Prove user is real person without revealing identity
verifyIdentity(proof) {
  // Proof shows:
  // - User controls private key
  // - User has valid ID (without showing it)
  // - User meets age requirements
}
```

##### Reputation Proof
```javascript
// Prove good reputation without revealing transactions
verifyReputation(proof) {
  // Proof shows:
  // - User has X successful transactions
  // - User has Y reputation score
  // - WITHOUT revealing which transactions
}
```

##### Compliance Proof
```javascript
// Prove compliance with regulations
verifyCompliance(proof) {
  // Proof shows:
  // - User is from allowed jurisdiction
  // - User passed KYC (without revealing details)
  // - User meets trading limits
}
```

##### Privacy-Preserving Dispute Resolution
```javascript
// Prove right to dispute without revealing full history
verifyDisputeRight(proof) {
  // Proof shows:
  // - User is genuine participant
  // - User has legitimate concern
  // - User hasn't abused dispute system
}
```

---

#### 5. **Integration Points**

**Smart Contract Integration**:
```solidity
// Add to ZKMarketplace.sol
function verifyAndSetUserStatus(
    address user,
    bytes calldata proof,
    bytes calldata publicInputs
) external {
    // Verify ZK proof on-chain
    require(zkVerifier.verify(proof, publicInputs), "Invalid proof");
    verifiedUsers[user] = true;
}
```

**Frontend Integration**:
```javascript
// In frontend/components/VerificationModal.js
const generateProof = async () => {
  // 1. Collect user data
  // 2. Generate proof client-side
  // 3. Submit to contract
  // 4. User is verified without revealing data
}
```

---

## 🚀 Deployment Scripts (`/scripts`)

### `/scripts/deploy.js`

**Purpose**: Deploy contracts to local Hardhat network.

**Flow**:
```javascript
1. Get contract factory
   └── Compiles contract if needed

2. Get deployer account
   └── Uses first Hardhat account

3. Deploy ZKMarketplace
   └── Pass fee recipient address (deployer)

4. Wait for deployment
   └── Waits for transaction confirmation

5. Verify deployment
   └── Read contract values to confirm

6. Log deployment info
   └── Address, network, config
```

**Output**:
```json
{
  "network": "localhost",
  "contractAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "deployer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "platformFee": "250",
  "feeRecipient": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "timestamp": "2025-09-28T18:24:28.057Z"
}
```

**Usage**:
```bash
npx hardhat run scripts/deploy.js --network localhost
```

---

### `/scripts/deploy-testnet.js`

**Purpose**: Deploy to public testnets (Goerli, Sepolia) or mainnet.

**Differences from deploy.js**:

1. **Multiple Contracts**
   - Deploys ZKMarketplace
   - Deploys DisputeResolution
   - Links them together

2. **Deployment Info Saved**
   - Saves to `/deployments` folder
   - JSON file with all addresses
   - Timestamped for version tracking

3. **Network Configuration**
   - Uses network from Hardhat config
   - Gets RPC URL from environment
   - Uses private key from environment

**Flow**:
```javascript
1. Deploy ZKMarketplace
   └── Wait for confirmation

2. Deploy DisputeResolution
   └── Pass marketplace address
   └── Pass arbitrator address

3. Save deployment info
   └── Create deployments/goerli-{timestamp}.json
   └── {
       network: "goerli",
       contracts: {
         ZKMarketplace: { address, abi },
         DisputeResolution: { address, abi }
       },
       deployer, timestamp, rpcUrl, chainId
     }

4. Log all information
   └── Contract addresses
   └── Configuration
   └── File location
```

**Usage**:
```bash
# Deploy to Goerli testnet
npx hardhat run scripts/deploy-testnet.js --network goerli

# Deploy to Sepolia testnet
npx hardhat run scripts/deploy-testnet.js --network sepolia

# Deploy to mainnet (use with caution!)
npx hardhat run scripts/deploy-testnet.js --network mainnet
```

**Environment Variables Needed**:
```bash
GOERLI_RPC_URL=https://goerli.infura.io/v3/YOUR_KEY
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=for_verification
```

---

## 📁 Deployments Directory (`/deployments`)

**Purpose**: Stores deployment records for each network.

**Structure**:
```
/deployments
├── localhost-1696000000000.json
├── goerli-1696100000000.json
├── sepolia-1696200000000.json
└── mainnet-1696300000000.json
```

**File Contents**:
```json
{
  "network": "goerli",
  "contracts": {
    "ZKMarketplace": {
      "address": "0x1234...",
      "abi": "ZKMarketplace.sol"
    },
    "DisputeResolution": {
      "address": "0x5678...",
      "abi": "DisputeResolution.sol"
    }
  },
  "deployer": "0xabcd...",
  "platformFee": "250",
  "feeRecipient": "0xabcd...",
  "timestamp": "2025-09-28T20:00:00.000Z",
  "rpcUrl": "https://goerli.infura.io/v3/...",
  "chainId": 5
}
```

**Usage**:
- Track deployments across networks
- Easy contract address lookup
- Version history
- Audit trail
- Configuration backup

---

## 🔄 Deployment Workflow

### Local Development:
```
1. Start Hardhat node
   └── npx hardhat node

2. Deploy contracts
   └── npx hardhat run scripts/deploy.js --network localhost

3. Update frontend config
   └── Update NEXT_PUBLIC_CONTRACT_ADDRESS

4. Start backend indexer
   └── Use contract address in .env

5. Start frontend
   └── Connect wallet to localhost:8545
```

### Testnet Deployment:
```
1. Get testnet ETH
   └── Goerli faucet, Sepolia faucet

2. Set environment variables
   └── RPC URL, Private key

3. Deploy contracts
   └── npx hardhat run scripts/deploy-testnet.js --network goerli

4. Verify on Etherscan
   └── npx hardhat verify --network goerli CONTRACT_ADDRESS

5. Update production config
   └── Point frontend to testnet RPC
   └── Update contract addresses

6. Deploy backend
   └── Point to testnet RPC
   └── Start from block 0 or deployment block

7. Deploy frontend
   └── Build and deploy to Vercel/Netlify
```

---

This completes Part 3: ZK Verification & Scripts.

**Next Part Available**:
- Part 4: Configuration, Testing & Development Tools

Would you like me to continue?
