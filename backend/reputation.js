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

// ============ REPUTATION CONSTANTS ============

const REPUTATION_CONSTANTS = {
    INITIAL_SCORE: 50,
    PER_SUCCESS: 10,
    PER_FAILURE: -15,
    MIN_SCORE: -100,
    MAX_SCORE: 1000,
    
    // Tier thresholds
    TIER_BRONZE: 0,
    TIER_SILVER: 50,
    TIER_GOLD: 100,
    TIER_PLATINUM: 200,
    TIER_DIAMOND: 500,
    
    // Verification requirements
    MIN_FOR_VERIFICATION: 50,
    MIN_ORDERS_FOR_VERIFICATION: 5,
    MIN_SUCCESS_RATE: 80
};

// ============ REPUTATION CALCULATION ============

/**
 * Calculate reputation score for a user based on their history
 * @param {string} address - User's Ethereum address
 * @returns {Object} Calculated reputation details
 */
async function calculateReputationScore(address) {
    try {
        const normalizedAddress = address.toLowerCase();
        
        // Get user's order history
        const orders = await pool.query(
            `SELECT 
                COUNT(*) as total_orders,
                COUNT(*) FILTER (WHERE status = 'confirmed') as successful_orders,
                COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders
            FROM orders
            WHERE seller_address = $1 OR buyer_address = $1`,
            [normalizedAddress]
        );
        
        const orderStats = orders.rows[0];
        const totalOrders = parseInt(orderStats.total_orders);
        const successfulOrders = parseInt(orderStats.successful_orders);
        const failedOrders = parseInt(orderStats.cancelled_orders);
        
        // Get dispute history
        const disputes = await pool.query(
            `SELECT 
                COUNT(*) as total_disputes,
                COUNT(*) FILTER (WHERE status = 'resolved') as resolved_disputes
            FROM disputes
            WHERE raised_by = $1`,
            [normalizedAddress]
        );
        
        const disputeStats = disputes.rows[0];
        const totalDisputes = parseInt(disputeStats.total_disputes);
        
        // Calculate base score
        let score = REPUTATION_CONSTANTS.INITIAL_SCORE;
        score += (successfulOrders * REPUTATION_CONSTANTS.PER_SUCCESS);
        score += (failedOrders * REPUTATION_CONSTANTS.PER_FAILURE);
        score -= (totalDisputes * 5); // Penalty for disputes
        
        // Cap score
        score = Math.max(REPUTATION_CONSTANTS.MIN_SCORE, Math.min(REPUTATION_CONSTANTS.MAX_SCORE, score));
        
        // Calculate success rate
        const successRate = totalOrders > 0 ? (successfulOrders / totalOrders) * 100 : 0;
        
        // Determine tier
        const tier = getTier(score);
        
        // Check verification eligibility
        const canBeVerified = checkVerificationEligibility(score, totalOrders, successRate);
        
        return {
            address: normalizedAddress,
            score: score,
            tier: tier,
            totalOrders: totalOrders,
            successfulOrders: successfulOrders,
            failedOrders: failedOrders,
            totalDisputes: totalDisputes,
            successRate: Math.round(successRate),
            canBeVerified: canBeVerified
        };
        
    } catch (error) {
        console.error('Error calculating reputation:', error);
        throw error;
    }
}

/**
 * Get reputation tier based on score
 * @param {number} score - Reputation score
 * @returns {string} Tier name
 */
function getTier(score) {
    if (score >= REPUTATION_CONSTANTS.TIER_DIAMOND) return 'Diamond';
    if (score >= REPUTATION_CONSTANTS.TIER_PLATINUM) return 'Platinum';
    if (score >= REPUTATION_CONSTANTS.TIER_GOLD) return 'Gold';
    if (score >= REPUTATION_CONSTANTS.TIER_SILVER) return 'Silver';
    return 'Bronze';
}

/**
 * Check if user is eligible for verification
 * @param {number} score - Reputation score
 * @param {number} totalOrders - Total orders
 * @param {number} successRate - Success rate percentage
 * @returns {boolean} Eligibility
 */
function checkVerificationEligibility(score, totalOrders, successRate) {
    return score >= REPUTATION_CONSTANTS.MIN_FOR_VERIFICATION &&
           totalOrders >= REPUTATION_CONSTANTS.MIN_ORDERS_FOR_VERIFICATION &&
           successRate >= REPUTATION_CONSTANTS.MIN_SUCCESS_RATE;
}

/**
 * Update user's reputation in database
 * @param {string} address - User's Ethereum address
 * @returns {Object} Updated reputation
 */
async function updateUserReputation(address) {
    try {
        const reputation = await calculateReputationScore(address);
        
        // Get current score for history
        const current = await pool.query(
            'SELECT reputation_score FROM users WHERE address = $1',
            [address.toLowerCase()]
        );
        
        const oldScore = current.rows.length > 0 ? current.rows[0].reputation_score : REPUTATION_CONSTANTS.INITIAL_SCORE;
        
        // Update user reputation
        await pool.query(
            `INSERT INTO users (address, reputation_score)
             VALUES ($1, $2)
             ON CONFLICT (address) DO UPDATE SET
                reputation_score = $2,
                updated_at = CURRENT_TIMESTAMP`,
            [address.toLowerCase(), reputation.score]
        );
        
        // Log history if score changed
        if (oldScore !== reputation.score) {
            await pool.query(
                `INSERT INTO reputation_history (user_address, old_score, new_score, reason)
                 VALUES ($1, $2, $3, $4)`,
                [address.toLowerCase(), oldScore, reputation.score, 'Calculated from order history']
            );
        }
        
        console.log(`⭐ Updated reputation for ${address.substring(0, 10)}...: ${oldScore} → ${reputation.score} (${reputation.tier})`);
        
        return reputation;
        
    } catch (error) {
        console.error('Error updating reputation:', error);
        throw error;
    }
}

/**
 * Get leaderboard (top users by reputation)
 * @param {number} limit - Number of users to return
 * @returns {Array} Top users
 */
async function getLeaderboard(limit = 10) {
    try {
        const result = await pool.query(
            `SELECT 
                address,
                reputation_score,
                is_verified,
                (SELECT COUNT(*) FROM orders WHERE seller_address = users.address AND status = 'confirmed') as successful_sales
            FROM users
            ORDER BY reputation_score DESC
            LIMIT $1`,
            [limit]
        );
        
        return result.rows.map(user => ({
            ...user,
            tier: getTier(user.reputation_score)
        }));
        
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        throw error;
    }
}

/**
 * Batch update all users' reputations
 * @returns {number} Number of users updated
 */
async function batchUpdateAllReputations() {
    try {
        console.log('🔄 Starting batch reputation update...');
        
        // Get all users
        const users = await pool.query('SELECT address FROM users');
        
        let updated = 0;
        for (const user of users.rows) {
            await updateUserReputation(user.address);
            updated++;
        }
        
        console.log(`✅ Updated ${updated} users`);
        return updated;
        
    } catch (error) {
        console.error('Error in batch update:', error);
        throw error;
    }
}

/**
 * Get reputation statistics
 * @returns {Object} Statistics
 */
async function getReputationStatistics() {
    try {
        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total_users,
                AVG(reputation_score)::INTEGER as avg_score,
                MAX(reputation_score) as max_score,
                MIN(reputation_score) as min_score,
                COUNT(*) FILTER (WHERE reputation_score >= ${REPUTATION_CONSTANTS.TIER_DIAMOND}) as diamond_users,
                COUNT(*) FILTER (WHERE reputation_score >= ${REPUTATION_CONSTANTS.TIER_PLATINUM} AND reputation_score < ${REPUTATION_CONSTANTS.TIER_DIAMOND}) as platinum_users,
                COUNT(*) FILTER (WHERE reputation_score >= ${REPUTATION_CONSTANTS.TIER_GOLD} AND reputation_score < ${REPUTATION_CONSTANTS.TIER_PLATINUM}) as gold_users,
                COUNT(*) FILTER (WHERE reputation_score >= ${REPUTATION_CONSTANTS.TIER_SILVER} AND reputation_score < ${REPUTATION_CONSTANTS.TIER_GOLD}) as silver_users,
                COUNT(*) FILTER (WHERE reputation_score < ${REPUTATION_CONSTANTS.TIER_SILVER}) as bronze_users
            FROM users
        `);
        
        return stats.rows[0];
        
    } catch (error) {
        console.error('Error fetching reputation statistics:', error);
        throw error;
    }
}

// ============ MAIN (for testing) ============

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('⭐ ZK Marketplace Reputation Calculator');
    console.log('='.repeat(60) + '\n');
    
    // Test database connection
    try {
        await pool.query('SELECT NOW()');
        console.log('✅ Database connected\n');
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
    
    // Get statistics
    const stats = await getReputationStatistics();
    console.log('📊 Reputation Statistics:');
    console.log(`   Total Users: ${stats.total_users}`);
    console.log(`   Average Score: ${stats.avg_score}`);
    console.log(`   Score Range: ${stats.min_score} - ${stats.max_score}`);
    console.log('\n📈 User Distribution:');
    console.log(`   💎 Diamond: ${stats.diamond_users}`);
    console.log(`   🏆 Platinum: ${stats.platinum_users}`);
    console.log(`   🥇 Gold: ${stats.gold_users}`);
    console.log(`   🥈 Silver: ${stats.silver_users}`);
    console.log(`   🥉 Bronze: ${stats.bronze_users}`);
    console.log('');
    
    // Get leaderboard
    const leaderboard = await getLeaderboard(5);
    console.log('🏆 Top 5 Users:');
    leaderboard.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.address.substring(0, 10)}... - ${user.reputation_score} (${user.tier})`);
    });
    console.log('');
    
    await pool.end();
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

// ============ EXPORTS ============

module.exports = {
    calculateReputationScore,
    updateUserReputation,
    getLeaderboard,
    batchUpdateAllReputations,
    getReputationStatistics,
    getTier,
    checkVerificationEligibility,
    REPUTATION_CONSTANTS
};


