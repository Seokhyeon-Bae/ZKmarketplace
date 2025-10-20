const { ethers } = require('ethers');
const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection pool
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'zk_marketplace',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
});

// Blockchain connection
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const START_BLOCK = parseInt(process.env.START_BLOCK || '0');

// Contract ABI (only events we care about)
const CONTRACT_ABI = [
    "event OrderCreated(uint256 indexed orderId, address indexed seller, address indexed buyer, uint256 amount, string description, uint256 timestamp)",
    "event OrderFunded(uint256 indexed orderId, address indexed buyer, uint256 amount, uint256 timestamp)",
    "event OrderConfirmed(uint256 indexed orderId, address indexed seller, uint256 amount, uint256 timestamp)",
    "event ReputationUpdated(address indexed user, int256 oldScore, int256 newScore, string reason)",
    "event OrderCancelled(uint256 indexed orderId, address indexed cancelledBy, uint256 timestamp)",
    // View functions
    "function getOrder(uint256 orderId) view returns (tuple(uint256 id, address seller, address buyer, uint256 amount, string description, uint8 status, uint256 createdAt, uint256 fundedAt, uint256 confirmedAt))",
    "function getUserReputation(address user) view returns (int256 score, uint256 successfulOrders, uint256 failedOrders, uint256 totalOrders, bool isVerified)"
];

let provider, contract, lastProcessedBlock;

// ============ INITIALIZATION ============

async function initialize() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 ZK Marketplace Blockchain Indexer');
    console.log('='.repeat(60));
    console.log(`📡 RPC URL: ${RPC_URL}`);
    console.log(`📄 Contract: ${CONTRACT_ADDRESS}`);
    console.log(`🔢 Start Block: ${START_BLOCK}`);
    console.log('='.repeat(60) + '\n');

    if (!CONTRACT_ADDRESS) {
        throw new Error('CONTRACT_ADDRESS not set in environment variables');
    }

    // Connect to blockchain
    provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    // Test connection
    const network = await provider.getNetwork();
    console.log(`✅ Connected to network: ${network.name} (chainId: ${network.chainId})`);

    // Test database
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected\n');

    lastProcessedBlock = START_BLOCK;
}

// ============ EVENT HANDLERS ============

async function handleOrderCreated(event) {
    try {
        const { orderId, seller, buyer, amount, description, timestamp } = event.args;
        
        console.log(`📦 Order Created: #${orderId} by ${seller.substring(0, 10)}...`);
        
        // Ensure seller exists in users table
        await ensureUserExists(seller);
        
        // Insert order
        await pool.query(
            `INSERT INTO orders (order_id, seller_address, buyer_address, amount_wei, description, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7))
             ON CONFLICT (order_id) DO UPDATE SET
                description = EXCLUDED.description,
                updated_at = CURRENT_TIMESTAMP`,
            [
                orderId.toString(),
                seller.toLowerCase(),
                '0x0000000000000000000000000000000000000000', // No buyer yet
                amount.toString(),
                description,
                'pending',
                timestamp.toString()
            ]
        );
        
        // Log event
        await logEvent(event, 'OrderCreated');
        
    } catch (error) {
        console.error('Error handling OrderCreated:', error);
    }
}

async function handleOrderFunded(event) {
    try {
        const { orderId, buyer, amount, timestamp } = event.args;
        
        console.log(`💰 Order Funded: #${orderId} by ${buyer.substring(0, 10)}...`);
        
        // Ensure buyer exists
        await ensureUserExists(buyer);
        
        // Update order
        await pool.query(
            `UPDATE orders 
             SET buyer_address = $1, status = $2, updated_at = CURRENT_TIMESTAMP
             WHERE order_id = $3`,
            [buyer.toLowerCase(), 'funded', orderId.toString()]
        );
        
        // Log event
        await logEvent(event, 'OrderFunded');
        
    } catch (error) {
        console.error('Error handling OrderFunded:', error);
    }
}

async function handleOrderConfirmed(event) {
    try {
        const { orderId, seller, amount, timestamp } = event.args;
        
        console.log(`✅ Order Confirmed: #${orderId}`);
        
        // Update order
        await pool.query(
            `UPDATE orders 
             SET status = $1, confirmed_at = to_timestamp($2), updated_at = CURRENT_TIMESTAMP
             WHERE order_id = $3`,
            ['confirmed', timestamp.toString(), orderId.toString()]
        );
        
        // Update reputation scores from blockchain
        await syncUserReputation(seller);
        
        // Get buyer address
        const orderResult = await pool.query(
            'SELECT buyer_address FROM orders WHERE order_id = $1',
            [orderId.toString()]
        );
        
        if (orderResult.rows.length > 0) {
            await syncUserReputation(orderResult.rows[0].buyer_address);
        }
        
        // Log event
        await logEvent(event, 'OrderConfirmed');
        
    } catch (error) {
        console.error('Error handling OrderConfirmed:', error);
    }
}

async function handleReputationUpdated(event) {
    try {
        const { user, oldScore, newScore, reason } = event.args;
        
        console.log(`⭐ Reputation Updated: ${user.substring(0, 10)}... ${oldScore} → ${newScore}`);
        
        // Sync full reputation from contract
        await syncUserReputation(user);
        
        // Log reputation history
        await pool.query(
            `INSERT INTO reputation_history (user_address, old_score, new_score, reason)
             VALUES ($1, $2, $3, $4)`,
            [user.toLowerCase(), oldScore.toString(), newScore.toString(), reason]
        );
        
        // Log event
        await logEvent(event, 'ReputationUpdated');
        
    } catch (error) {
        console.error('Error handling ReputationUpdated:', error);
    }
}

async function handleOrderCancelled(event) {
    try {
        const { orderId, cancelledBy, timestamp } = event.args;
        
        console.log(`❌ Order Cancelled: #${orderId}`);
        
        // Update order
        await pool.query(
            `UPDATE orders 
             SET status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE order_id = $2`,
            ['cancelled', orderId.toString()]
        );
        
        // Log event
        await logEvent(event, 'OrderCancelled');
        
    } catch (error) {
        console.error('Error handling OrderCancelled:', error);
    }
}

// ============ HELPER FUNCTIONS ============

async function ensureUserExists(address) {
    try {
        const normalizedAddress = address.toLowerCase();
        
        // Check if user exists
        const result = await pool.query(
            'SELECT address FROM users WHERE address = $1',
            [normalizedAddress]
        );
        
        if (result.rows.length === 0) {
            // Get reputation from contract
            const reputation = await contract.getUserReputation(address);
            
            // Create user
            await pool.query(
                `INSERT INTO users (address, reputation_score, is_verified)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (address) DO NOTHING`,
                [
                    normalizedAddress,
                    parseInt(reputation.score.toString()),
                    reputation.isVerified
                ]
            );
            
            console.log(`   👤 Created user: ${normalizedAddress.substring(0, 10)}...`);
        }
    } catch (error) {
        console.error('Error ensuring user exists:', error);
    }
}

async function syncUserReputation(address) {
    try {
        const reputation = await contract.getUserReputation(address);
        
        await pool.query(
            `UPDATE users 
             SET reputation_score = $1, 
                 is_verified = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE address = $3`,
            [
                parseInt(reputation.score.toString()),
                reputation.isVerified,
                address.toLowerCase()
            ]
        );
        
        console.log(`   ⭐ Synced reputation for ${address.substring(0, 10)}...: ${reputation.score}`);
    } catch (error) {
        console.error('Error syncing user reputation:', error);
    }
}

async function logEvent(event, eventName) {
    try {
        await pool.query(
            `INSERT INTO events (block_number, transaction_hash, event_name, event_data)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (transaction_hash, event_name) DO NOTHING`,
            [
                event.blockNumber,
                event.transactionHash,
                eventName,
                JSON.stringify(event.args)
            ]
        );
    } catch (error) {
        console.error('Error logging event:', error);
    }
}

// ============ BLOCK PROCESSING ============

async function processHistoricalEvents() {
    try {
        const currentBlock = await provider.getBlockNumber();
        console.log(`📚 Processing historical events from block ${lastProcessedBlock} to ${currentBlock}...\n`);
        
        // Query all events
        const filters = [
            contract.filters.OrderCreated(),
            contract.filters.OrderFunded(),
            contract.filters.OrderConfirmed(),
            contract.filters.ReputationUpdated(),
            contract.filters.OrderCancelled()
        ];
        
        for (const filter of filters) {
            const events = await contract.queryFilter(filter, lastProcessedBlock, currentBlock);
            
            for (const event of events) {
                const eventName = event.event;
                
                switch (eventName) {
                    case 'OrderCreated':
                        await handleOrderCreated(event);
                        break;
                    case 'OrderFunded':
                        await handleOrderFunded(event);
                        break;
                    case 'OrderConfirmed':
                        await handleOrderConfirmed(event);
                        break;
                    case 'ReputationUpdated':
                        await handleReputationUpdated(event);
                        break;
                    case 'OrderCancelled':
                        await handleOrderCancelled(event);
                        break;
                }
            }
        }
        
        lastProcessedBlock = currentBlock + 1;
        console.log(`\n✅ Processed up to block ${currentBlock}\n`);
        
    } catch (error) {
        console.error('Error processing historical events:', error);
    }
}

async function startRealTimeListening() {
    console.log('👂 Listening for real-time events...\n');
    
    // Listen for new events
    contract.on('OrderCreated', handleOrderCreated);
    contract.on('OrderFunded', handleOrderFunded);
    contract.on('OrderConfirmed', handleOrderConfirmed);
    contract.on('ReputationUpdated', handleReputationUpdated);
    contract.on('OrderCancelled', handleOrderCancelled);
    
    // Process new blocks periodically
    setInterval(async () => {
        const currentBlock = await provider.getBlockNumber();
        if (currentBlock > lastProcessedBlock) {
            await processHistoricalEvents();
        }
    }, 5000); // Check every 5 seconds
}

// ============ STATISTICS ============

async function printStatistics() {
    try {
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as users,
                (SELECT COUNT(*) FROM orders) as orders,
                (SELECT COUNT(*) FROM orders WHERE status = 'confirmed') as confirmed,
                (SELECT COUNT(*) FROM events) as events_logged
        `);
        
        const s = stats.rows[0];
        console.log('📊 Current Statistics:');
        console.log(`   Users: ${s.users}`);
        console.log(`   Orders: ${s.orders} (${s.confirmed} confirmed)`);
        console.log(`   Events Logged: ${s.events_logged}`);
        console.log('');
    } catch (error) {
        console.error('Error fetching statistics:', error);
    }
}

// ============ MAIN ============

async function main() {
    try {
        await initialize();
        
        // Process historical events first
        await processHistoricalEvents();
        
        // Show statistics
        await printStatistics();
        
        // Start listening for real-time events
        await startRealTimeListening();
        
        // Print statistics every 60 seconds
        setInterval(printStatistics, 60000);
        
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

// ============ GRACEFUL SHUTDOWN ============

process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down indexer gracefully...');
    
    // Remove event listeners
    contract.removeAllListeners();
    
    // Close database connection
    await pool.end();
    
    console.log('✅ Indexer stopped');
    process.exit(0);
});

// Start the indexer
main();


