const { ethers } = require('ethers');
const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'zk_marketplace',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

// Contract ABI (simplified for ZK Marketplace)
const CONTRACT_ABI = [
  "event OrderCreated(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 amount, string description)",
  "event OrderFunded(uint256 indexed orderId, uint256 amount)",
  "event OrderConfirmed(uint256 indexed orderId, address indexed buyer)",
  "event DisputeRaised(uint256 indexed disputeId, uint256 indexed orderId, address indexed raisedBy, string reason)",
  "event DisputeResolved(uint256 indexed disputeId, bool buyerWins)"
];

class BlockchainIndexer {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');
    this.contractAddress = process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    this.contract = new ethers.Contract(this.contractAddress, CONTRACT_ABI, this.provider);
    this.startBlock = parseInt(process.env.START_BLOCK || '0');
    this.isRunning = false;
  }

  async start() {
    console.log('🔍 Starting ZK Marketplace Blockchain Indexer...');
    console.log(`📡 RPC URL: ${this.provider.connection.url}`);
    console.log(`📄 Contract: ${this.contractAddress}`);
    console.log(`🔢 Start Block: ${this.startBlock}`);
    
    this.isRunning = true;
    await this.indexHistoricalEvents();
    await this.startRealTimeIndexing();
  }

  async indexHistoricalEvents() {
    try {
      console.log('📚 Indexing historical events...');
      
      // Get current block number
      const currentBlock = await this.provider.getBlockNumber();
      console.log(`📊 Current block: ${currentBlock}, Start block: ${this.startBlock}`);
      
      if (currentBlock <= this.startBlock) {
        console.log('✅ No new blocks to index');
        return;
      }

      // Process events in batches
      const batchSize = 1000;
      for (let fromBlock = this.startBlock; fromBlock <= currentBlock; fromBlock += batchSize) {
        const toBlock = Math.min(fromBlock + batchSize - 1, currentBlock);
        
        console.log(`🔍 Processing blocks ${fromBlock} to ${toBlock}...`);
        await this.processEvents(fromBlock, toBlock);
      }
      
      console.log('✅ Historical indexing completed');
    } catch (error) {
      console.error('❌ Error indexing historical events:', error);
    }
  }

  async startRealTimeIndexing() {
    console.log('🔄 Starting real-time event monitoring...');
    
    // Listen for new blocks
    this.provider.on('block', async (blockNumber) => {
      if (this.isRunning) {
        console.log(`📦 New block: ${blockNumber}`);
        await this.processEvents(blockNumber, blockNumber);
      }
    });
  }

  async processEvents(fromBlock, toBlock) {
    try {
      // Get all events from the contract
      const filter = {
        address: this.contractAddress,
        fromBlock,
        toBlock
      };

      const events = await this.contract.queryFilter(filter);
      
      for (const event of events) {
        await this.handleEvent(event);
      }
    } catch (error) {
      console.error(`❌ Error processing events from ${fromBlock} to ${toBlock}:`, error);
    }
  }

  async handleEvent(event) {
    try {
      const { blockNumber, transactionHash, eventName, args } = event;
      
      console.log(`📝 Processing event: ${eventName} in block ${blockNumber}`);
      
      // Check if event already exists
      const existingEvent = await pool.query(
        'SELECT id FROM events WHERE transaction_hash = $1 AND event_name = $2',
        [transactionHash, eventName]
      );
      
      if (existingEvent.rows.length > 0) {
        console.log(`⏭️  Event already processed: ${eventName}`);
        return;
      }

      // Store event in database
      await pool.query(
        `INSERT INTO events (block_number, transaction_hash, event_name, event_data, processed_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [blockNumber, transactionHash, eventName, JSON.stringify(args)]
      );

      // Handle specific events
      switch (eventName) {
        case 'OrderCreated':
          await this.handleOrderCreated(args);
          break;
        case 'OrderFunded':
          await this.handleOrderFunded(args);
          break;
        case 'OrderConfirmed':
          await this.handleOrderConfirmed(args);
          break;
        case 'DisputeRaised':
          await this.handleDisputeRaised(args);
          break;
        case 'DisputeResolved':
          await this.handleDisputeResolved(args);
          break;
      }
      
      console.log(`✅ Event processed: ${eventName}`);
    } catch (error) {
      console.error('❌ Error handling event:', error);
    }
  }

  async handleOrderCreated(args) {
    const [orderId, buyer, seller, amount, description] = args;
    
    // Ensure users exist
    await this.ensureUserExists(buyer);
    await this.ensureUserExists(seller);
    
    // Create order
    await pool.query(
      `INSERT INTO orders (order_id, buyer_address, seller_address, amount_wei, description, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       ON CONFLICT (order_id) DO NOTHING`,
      [orderId.toString(), buyer, seller, amount.toString(), description]
    );
    
    console.log(`📋 Order created: ${orderId} - ${buyer} -> ${seller}`);
  }

  async handleOrderFunded(args) {
    const [orderId, amount] = args;
    
    await pool.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2',
      ['funded', orderId.toString()]
    );
    
    console.log(`💰 Order funded: ${orderId} - ${amount} wei`);
  }

  async handleOrderConfirmed(args) {
    const [orderId, buyer] = args;
    
    await pool.query(
      'UPDATE orders SET status = $1, confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2',
      ['completed', orderId.toString()]
    );
    
    console.log(`✅ Order confirmed: ${orderId} by ${buyer}`);
  }

  async handleDisputeRaised(args) {
    const [disputeId, orderId, raisedBy, reason] = args;
    
    // Create dispute
    await pool.query(
      `INSERT INTO disputes (dispute_id, order_id, raised_by, reason, status)
       VALUES ($1, $2, $3, $4, 'open')
       ON CONFLICT (dispute_id) DO NOTHING`,
      [disputeId.toString(), orderId.toString(), raisedBy, reason]
    );
    
    // Update order status
    await pool.query(
      'UPDATE orders SET status = $1, dispute_raised_at = CURRENT_TIMESTAMP WHERE order_id = $2',
      ['disputed', orderId.toString()]
    );
    
    console.log(`⚠️  Dispute raised: ${disputeId} for order ${orderId}`);
  }

  async handleDisputeResolved(args) {
    const [disputeId, buyerWins] = args;
    
    await pool.query(
      'UPDATE disputes SET status = $1, resolved_at = CURRENT_TIMESTAMP WHERE dispute_id = $2',
      ['resolved', disputeId.toString()]
    );
    
    console.log(`⚖️  Dispute resolved: ${disputeId} - Buyer wins: ${buyerWins}`);
  }

  async ensureUserExists(address) {
    await pool.query(
      `INSERT INTO users (address, reputation_score, is_verified)
       VALUES ($1, 0, false)
       ON CONFLICT (address) DO NOTHING`,
      [address]
    );
  }

  async stop() {
    console.log('🛑 Stopping blockchain indexer...');
    this.isRunning = false;
    await pool.end();
  }
}

// Start the indexer
const indexer = new BlockchainIndexer();

indexer.start().catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down indexer...');
  await indexer.stop();
  process.exit(0);
});

