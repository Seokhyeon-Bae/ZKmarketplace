# ZK Marketplace

A decentralized marketplace built on Ethereum with Zero-Knowledge (ZK) verification capabilities, escrow functionality, and dispute resolution.

## 🚀 Features

- **Smart Contract Escrow**: Secure order management with automatic fund handling
- **ZK Verification**: Zero-knowledge proof verification for user credentials
- **Dispute Resolution**: Decentralized dispute handling with evidence submission
- **Reputation System**: User reputation scoring based on transaction history
- **Real-time Indexing**: Blockchain event indexing with PostgreSQL database
- **Modern UI**: Next.js frontend with wallet integration

## 📋 Project Structure

```
zk-marketplace/
├── contracts/           # Smart contracts
│   ├── ZKMarketplace.sol
│   └── DisputeResolution.sol
├── backend/             # Backend services
│   ├── server.js        # API server
│   ├── indexer.js       # Blockchain indexer
│   ├── reputation.js    # Reputation system
│   └── schema.sql       # Database schema
├── frontend/            # Next.js frontend
│   ├── pages/
│   ├── components/
│   └── styles/
├── zk/                  # ZK verification
│   └── verification.js
└── scripts/             # Deployment scripts
    └── deploy.js
```

## 🛠️ Setup Instructions

### Prerequisites

- Node.js (v18+)
- PostgreSQL
- Git

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd zk-marketplace

# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Database Setup

```bash
# Create PostgreSQL database
createdb zk_marketplace

# Run database schema
psql zk_marketplace < backend/schema.sql
```

### 3. Environment Configuration

Create `.env` files:

**backend/.env:**
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=zk_marketplace
DB_USER=postgres
DB_PASSWORD=password
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
START_BLOCK=0
PORT=3001
```

**frontend/.env.local:**
```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
```

### 4. Smart Contract Deployment

```bash
# Start Hardhat node
npx hardhat node

# In another terminal, deploy contracts
npx hardhat run scripts/deploy.js --network localhost
```

### 5. Start Services

```bash
# Terminal 1: Start backend API
cd backend
npm start

# Terminal 2: Start blockchain indexer
cd backend
npm run indexer

# Terminal 3: Start frontend
cd frontend
npm run dev
```

## 🔧 Development

### Smart Contracts

The marketplace consists of two main contracts:

1. **ZKMarketplace.sol**: Core marketplace functionality
   - Order creation and funding
   - Escrow management
   - Fee handling
   - Basic reputation tracking

2. **DisputeResolution.sol**: Dispute handling
   - Dispute creation
   - Evidence submission
   - Arbitration process

### Backend Services

- **API Server** (`server.js`): REST API for frontend
- **Indexer** (`indexer.js`): Real-time blockchain event processing
- **Reputation System** (`reputation.js`): User reputation calculation

### Frontend

- **Next.js** application with wallet integration
- **Wagmi** for Ethereum interactions
- **RainbowKit** for wallet connection
- **Tailwind CSS** for styling

## 📊 API Endpoints

### Orders
- `GET /api/orders` - List all orders
- `GET /api/orders/:id` - Get specific order
- `GET /api/users/:address/orders` - Get user orders

### Users
- `GET /api/users/:address` - Get user profile
- `POST /api/users` - Create user profile
- `PUT /api/users/:address` - Update user profile

### Disputes
- `GET /api/disputes` - List disputes
- `POST /api/disputes` - Create dispute

### Stats
- `GET /api/stats` - Marketplace statistics

## 🔐 ZK Verification

The ZK verification system (currently a stub) will support:

- **Identity Verification**: Prove identity without revealing personal data
- **Reputation Proofs**: Demonstrate reputation without exposing transaction history
- **Compliance Verification**: Prove meeting requirements without revealing details

## 🏆 Reputation System

Users earn reputation through:

- **Successful Orders**: +10 points per completed order
- **High-Value Orders**: 1.5x multiplier for orders > 1 ETH
- **Dispute Resolution**: +15 for winning, -10 for losing
- **Verified Status**: 1.2x multiplier for ZK verified users

### Reputation Tiers

- **Trusted Seller** (200+ points): Priority listing, lower fees
- **High Reputation** (100+ points): Lower fees, reputation badge
- **Verified** (50+ points): Verified badge
- **New User** (0-49 points): Standard features

## 🚨 Dispute Resolution

1. **Dispute Creation**: Any order participant can raise a dispute
2. **Evidence Submission**: Submit evidence with IPFS hash
3. **Arbitration**: Authorized arbitrators review and decide
4. **Resolution**: Funds distributed based on decision

## 🧪 Testing

```bash
# Run smart contract tests
npx hardhat test

# Run backend tests
cd backend
npm test

# Run frontend tests
cd frontend
npm test
```

## 🚀 Deployment

### Local Development
```bash
# Start all services
npm run dev:all
```

### Production Deployment

1. **Smart Contracts**: Deploy to testnet/mainnet
2. **Backend**: Deploy to cloud provider (AWS, GCP, etc.)
3. **Frontend**: Deploy to Vercel, Netlify, etc.
4. **Database**: Use managed PostgreSQL service

## 📈 Roadmap

- [x] Basic escrow functionality
- [x] Local deployment setup
- [x] Database indexing
- [x] Web UI with wallet connect
- [x] ZK verification stub
- [x] Dispute resolution system
- [x] Reputation system
- [ ] Testnet deployment
- [ ] Real ZK proof integration
- [ ] Mobile app
- [ ] Advanced analytics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Join our Discord community
- Check the documentation

---

**Built with ❤️ for the decentralized future**




