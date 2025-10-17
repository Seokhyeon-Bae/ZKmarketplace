# ZK Marketplace - Complete Project Structure Explanation

## 📁 Project Overview

The ZK Marketplace is a decentralized marketplace built with Ethereum smart contracts, a Node.js backend, and a Next.js frontend. It features escrow functionality, dispute resolution, reputation systems, and ZK verification capabilities.

---

## Part 1: Smart Contracts (`/contracts`)

### 🔐 `/contracts/ZKMarketplace.sol`

**Purpose**: Core marketplace contract handling orders, escrow, and basic reputation.

**Key Components**:

1. **Order Management**
   - `createOrder(description)`: Seller creates an order by depositing funds
   - `fundOrder(orderId)`: Buyer matches the order by depositing equal amount
   - `confirmReceipt(orderId)`: Buyer confirms delivery, releases funds to seller
   - `cancelOrder(orderId)`: Seller can cancel unfunded orders

2. **Escrow System**
   - Holds funds in smart contract until confirmation
   - Automatically calculates and distributes platform fees (2.5%)
   - Transfers funds to seller after confirmation
   - Protects both buyer and seller

3. **Fee Management**
   - Platform fee: 250 basis points (2.5%)
   - Fee recipient: Configurable address
   - `setPlatformFee()`: Owner can adjust fees (max 10%)
   - `setFeeRecipient()`: Owner can change fee destination

4. **Data Structures**
   ```solidity
   Order {
     id, seller, buyer, amount, description,
     status (Created/Funded/Confirmed/Disputed/Resolved/Cancelled),
     timestamps (created/funded/confirmed)
   }
   ```

5. **Events**
   - `OrderCreated`: Emitted when seller creates order
   - `OrderFunded`: Emitted when buyer funds order
   - `OrderConfirmed`: Emitted when buyer confirms receipt

**Security Features**:
- Owner-only functions for admin tasks
- Status checks prevent invalid state transitions
- Amount validation prevents zero-value orders

---

### ⚖️ `/contracts/DisputeResolution.sol`

**Purpose**: Advanced dispute handling with evidence submission and arbitration.

**Key Components**:

1. **Dispute Creation**
   - `raiseDispute(orderId, reason, evidenceHash)`: Start a dispute
   - Requires dispute fee (0.01 ETH)
   - Only order participants can dispute
   - Links to IPFS evidence hash

2. **Evidence Management**
   - `submitEvidence(orderId, evidenceHash, description)`: Add evidence
   - Both parties can submit evidence
   - Evidence stored on-chain as IPFS hashes
   - Timestamped for transparency

3. **Arbitration System**
   - `resolveDispute(orderId, winner, resolution)`: Arbitrator decides
   - Only authorized arbitrators can resolve
   - Funds distributed to winning party (minus fees)
   - Resolution explanation stored on-chain

4. **Data Structures**
   ```solidity
   Dispute {
     orderId, disputer, reason, evidenceHash,
     status (Open/UnderReview/Resolved/Cancelled),
     winner, resolution, timestamps
   }
   
   Evidence {
     submitter, hash, description, timestamp
   }
   ```

5. **Access Control**
   - Main arbitrator address
   - Authorized arbitrators mapping
   - Owner can add/remove arbitrators

**Security Features**:
- Dispute fee prevents spam
- Only participants can dispute/submit evidence
- Arbitrator authorization system
- Emergency withdrawal function

---

## Part 2: Backend Services (`/backend`)

### 🌐 `/backend/server.js`

**Purpose**: REST API server providing database access to frontend.

**Endpoints**:

1. **Health & Stats**
   - `GET /health`: Server health check
   - `GET /api/stats`: Marketplace statistics (users, orders, volume)

2. **Order Management**
   - `GET /api/orders`: List all orders (paginated)
     - Query params: `?page=1&limit=20&status=Funded`
   - `GET /api/orders/:id`: Get specific order details
   - Includes seller/buyer usernames and dispute info

3. **User Management**
   - `GET /api/users/:address`: Get user profile & stats
   - `POST /api/users`: Create/update user profile
     - Body: `{ address, username, email }`
   - `PUT /api/users/:address`: Update user profile
   - `GET /api/users/:address/orders`: Get user's order history
     - Query params: `?role=seller` or `?role=buyer`

4. **Dispute Management**
   - `GET /api/disputes`: List disputes by status
     - Query params: `?status=Open`

**Features**:
- CORS enabled for frontend access
- PostgreSQL connection pooling
- Error handling middleware
- JSON responses

---

### 📊 `/backend/indexer.js`

**Purpose**: Real-time blockchain event indexer that syncs smart contract events to database.

**Key Components**:

1. **Event Listening**
   - Connects to Ethereum node via RPC
   - Listens for contract events in real-time
   - Processes historical events from START_BLOCK

2. **Event Handlers**
   - `handleOrderCreated()`: Creates order in database
   - `handleOrderFunded()`: Updates order with buyer info
   - `handleOrderConfirmed()`: Marks order complete, updates reputation
   - `handleOrderDisputed()`: Creates dispute record
   - `handleDisputeResolved()`: Updates dispute and order status

3. **Database Sync**
   - Upserts user records automatically
   - Maintains order status in sync with blockchain
   - Stores all events for audit trail
   - Updates reputation scores in real-time

4. **Block Processing**
   - Batch processes blocks for efficiency
   - Tracks last processed block
   - Resumes from last position on restart
   - Handles blockchain reorganizations

**How It Works**:
```javascript
Start → Connect to blockchain
     → Fetch historical events
     → Process each event
     → Update database
     → Listen for new blocks
     → Repeat
```

**Features**:
- Automatic retry on errors
- Graceful shutdown (SIGINT handler)
- Statistics logging
- Event deduplication

---

### 🏆 `/backend/reputation.js`

**Purpose**: Advanced reputation scoring system for users.

**Reputation Calculation**:

1. **Base Scores**
   - Successful order: +10 points
   - Disputed order: -5 points
   - Won dispute: +15 points
   - Lost dispute: -10 points

2. **Multipliers**
   - High value orders (>1 ETH): 1.5x multiplier
   - ZK verified users: 1.2x multiplier
   - Early adopter bonus: +5 points (first 100 users)

3. **Reputation Tiers**
   ```
   Trusted Seller (200+): Priority listing, lower fees
   High Reputation (100+): Lower fees, reputation badge
   Verified (50+): Verified badge
   New User (0-49): Standard features
   ```

4. **Key Functions**
   - `calculateReputationScore(address)`: Compute user's score
   - `updateUserReputation(address)`: Update score in database
   - `getLeaderboard(limit)`: Get top users
   - `checkVerificationEligibility(address)`: Check if user can be verified
   - `processReputationUpdates()`: Batch update all users

5. **Verification Requirements**
   - Minimum 50 reputation points
   - At least 5 completed orders
   - 80%+ success rate
   - No recent disputes

**Features**:
- Real-time score calculation
- Leaderboard system
- Eligibility checking
- Batch processing for efficiency

---

### 🗄️ `/backend/schema.sql`

**Purpose**: PostgreSQL database schema defining all tables and relationships.

**Tables**:

1. **users**
   - Stores user profiles and reputation
   - Fields: address, username, email, is_verified, reputation_score, order counts
   - Indexes on address for fast lookups

2. **orders**
   - Stores all marketplace orders
   - Fields: order_id, seller/buyer addresses, amount, description, status, timestamps
   - Links to blockchain order_id
   - Tracks dispute status

3. **listings** (Future use)
   - For persistent product listings
   - Fields: seller, title, description, price, category, is_active

4. **disputes**
   - Stores dispute records
   - Fields: order_id, disputer, reason, evidence_hash, status, winner, timestamps
   - Links to orders table

5. **events**
   - Audit trail of all blockchain events
   - Fields: event_type, order_id, user_address, amount, block_number, tx_hash
   - For debugging and analytics

**Database Features**:
- Automatic timestamps (created_at, updated_at)
- Triggers for updated_at columns
- Comprehensive indexes for performance
- Foreign key relationships
- Unique constraints on addresses and order_ids

---

### 📦 `/backend/package.json`

**Purpose**: Backend dependencies and scripts.

**Dependencies**:
- `express`: Web server framework
- `cors`: Cross-origin request handling
- `pg`: PostgreSQL client
- `ethers`: Ethereum library for blockchain interaction
- `dotenv`: Environment variable management

**Scripts**:
- `start`: Run API server
- `dev`: Run with nodemon (auto-restart)
- `indexer`: Run blockchain indexer
- `dev:indexer`: Run indexer with auto-restart

---

### ⚙️ `/backend/.env.example`

**Purpose**: Template for environment configuration.

**Configuration**:
- Database connection (host, port, credentials)
- Blockchain RPC URL
- Contract address
- Server port
- Start block for indexing

---

This is Part 1 of the explanation. Would you like me to continue with:
- Part 2: Frontend Application (`/frontend`)
- Part 3: ZK Verification & Scripts
- Part 4: Configuration & Deployment Files

Let me know which part you'd like to explore next!
