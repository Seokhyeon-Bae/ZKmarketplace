// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ZKMarketplace with Reputation System
 * @dev Blockchain escrow marketplace with credit score verification
 * 
 * KEY FEATURES:
 * - Dual-deposit escrow (seller and buyer both deposit)
 * - Credit score tracking on-chain
 * - Blocks untrusted sellers (low reputation)
 * - Automatic fee distribution
 * - Event-driven architecture for off-chain sync
 */

contract ZKMarketplace {
    
    // ============ EVENTS ============
    
    event OrderCreated(
        uint256 indexed orderId,
        address indexed seller,
        address indexed buyer,
        uint256 amount,
        string description,
        uint256 timestamp
    );
    
    event OrderFunded(
        uint256 indexed orderId,
        address indexed buyer,
        uint256 amount,
        uint256 timestamp
    );
    
    event OrderConfirmed(
        uint256 indexed orderId,
        address indexed seller,
        uint256 amount,
        uint256 timestamp
    );
    
    event ReputationUpdated(
        address indexed user,
        int256 oldScore,
        int256 newScore,
        string reason
    );
    
    event OrderCancelled(
        uint256 indexed orderId,
        address indexed cancelledBy,
        uint256 timestamp
    );
    
    // ============ STRUCTS ============
    
    struct Order {
        uint256 id;
        address seller;
        address buyer;
        uint256 amount;
        string description;
        OrderStatus status;
        uint256 createdAt;
        uint256 fundedAt;
        uint256 confirmedAt;
    }
    
    struct UserReputation {
        int256 score;
        uint256 successfulOrders;
        uint256 failedOrders;
        uint256 totalOrders;
        bool isVerified;
    }
    
    // ============ ENUMS ============
    
    enum OrderStatus {
        Created,
        Funded,
        Confirmed,
        Disputed,
        Resolved,
        Cancelled
    }
    
    // ============ STATE VARIABLES ============
    
    uint256 public nextOrderId;
    uint256 public platformFeePercent = 250; // 2.5% (250/10000)
    address public feeRecipient;
    address public owner;
    
    // Reputation system
    int256 public constant MINIMUM_SELLER_REPUTATION = 0;
    int256 public constant REPUTATION_PER_SUCCESS = 10;
    int256 public constant REPUTATION_PER_FAILURE = -15;
    int256 public constant INITIAL_REPUTATION = 50; // New users start with 50
    
    mapping(uint256 => Order) public orders;
    mapping(address => UserReputation) public reputations;
    
    // ============ MODIFIERS ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }
    
    modifier onlyTrustedSeller() {
        // Check if seller has sufficient reputation
        if (reputations[msg.sender].totalOrders == 0) {
            // New user - initialize with default reputation
            reputations[msg.sender].score = INITIAL_REPUTATION;
        }
        
        require(
            reputations[msg.sender].score >= MINIMUM_SELLER_REPUTATION,
            "Insufficient reputation to sell"
        );
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    constructor(address _feeRecipient) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
        owner = msg.sender;
        
        // Initialize owner with high reputation
        reputations[owner].score = 100;
        reputations[owner].isVerified = true;
    }
    
    // ============ CORE MARKETPLACE FUNCTIONS ============
    
    /**
     * @dev Create an order - ONLY TRUSTED SELLERS
     * Reputation check: seller must have score >= MINIMUM_SELLER_REPUTATION
     */
    function createOrder(
        string memory description
    ) external payable onlyTrustedSeller returns (uint256) {
        require(msg.value > 0, "Amount must be greater than 0");
        require(bytes(description).length > 0, "Description cannot be empty");
        
        uint256 orderId = nextOrderId++;
        
        orders[orderId] = Order({
            id: orderId,
            seller: msg.sender,
            buyer: address(0),
            amount: msg.value,
            description: description,
            status: OrderStatus.Created,
            createdAt: block.timestamp,
            fundedAt: 0,
            confirmedAt: 0
        });
        
        emit OrderCreated(orderId, msg.sender, address(0), msg.value, description, block.timestamp);
        
        return orderId;
    }
    
    /**
     * @dev Fund an order - Buyer deposits matching amount
     */
    function fundOrder(uint256 orderId) external payable {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.Created, "Order not in correct status");
        require(msg.value == order.amount, "Incorrect funding amount");
        require(msg.sender != order.seller, "Seller cannot fund their own order");
        
        // Initialize buyer reputation if new
        if (reputations[msg.sender].totalOrders == 0) {
            reputations[msg.sender].score = INITIAL_REPUTATION;
        }
        
        order.buyer = msg.sender;
        order.status = OrderStatus.Funded;
        order.fundedAt = block.timestamp;
        
        emit OrderFunded(orderId, msg.sender, msg.value, block.timestamp);
    }
    
    /**
     * @dev Confirm receipt - Buyer confirms delivery
     * Updates reputation: +10 for seller, +5 for buyer
     */
    function confirmReceipt(uint256 orderId) external {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.Funded, "Order not funded");
        require(msg.sender == order.buyer, "Only buyer can confirm receipt");
        
        order.status = OrderStatus.Confirmed;
        order.confirmedAt = block.timestamp;
        
        // Calculate fees
        uint256 platformFee = (order.amount * platformFeePercent) / 10000;
        uint256 sellerAmount = order.amount - platformFee;
        
        // Update reputations - SUCCESS
        _updateReputation(order.seller, REPUTATION_PER_SUCCESS, "Successful sale");
        _updateReputation(order.buyer, REPUTATION_PER_SUCCESS / 2, "Successful purchase");
        
        // Increment successful orders
        reputations[order.seller].successfulOrders++;
        reputations[order.seller].totalOrders++;
        reputations[order.buyer].totalOrders++;
        
        // Transfer funds
        payable(order.seller).transfer(sellerAmount);
        payable(feeRecipient).transfer(platformFee);
        
        emit OrderConfirmed(orderId, order.seller, sellerAmount, block.timestamp);
    }
    
    /**
     * @dev Cancel order - Only seller can cancel unfunded orders
     */
    function cancelOrder(uint256 orderId) external {
        Order storage order = orders[orderId];
        require(msg.sender == order.seller, "Only seller can cancel");
        require(order.status == OrderStatus.Created, "Can only cancel unfunded orders");
        
        order.status = OrderStatus.Cancelled;
        
        // Return funds to seller
        payable(order.seller).transfer(order.amount);
        
        emit OrderCancelled(orderId, msg.sender, block.timestamp);
    }
    
    // ============ REPUTATION MANAGEMENT ============
    
    /**
     * @dev Internal function to update user reputation
     */
    function _updateReputation(address user, int256 change, string memory reason) internal {
        int256 oldScore = reputations[user].score;
        reputations[user].score += change;
        
        // Cap reputation between -100 and 1000
        if (reputations[user].score < -100) {
            reputations[user].score = -100;
        } else if (reputations[user].score > 1000) {
            reputations[user].score = 1000;
        }
        
        emit ReputationUpdated(user, oldScore, reputations[user].score, reason);
    }
    
    /**
     * @dev Penalize user reputation (owner only, for dispute resolution)
     */
    function penalizeReputation(address user, int256 penalty, string memory reason) external onlyOwner {
        require(penalty > 0, "Penalty must be positive");
        _updateReputation(user, -penalty, reason);
        reputations[user].failedOrders++;
    }
    
    /**
     * @dev Verify user (owner only)
     */
    function verifyUser(address user) external onlyOwner {
        require(reputations[user].score >= 50, "Reputation too low for verification");
        reputations[user].isVerified = true;
    }
    
    /**
     * @dev Revoke user verification (owner only)
     */
    function revokeVerification(address user) external onlyOwner {
        reputations[user].isVerified = false;
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }
    
    function getOrderStatus(uint256 orderId) external view returns (OrderStatus) {
        return orders[orderId].status;
    }
    
    function getUserReputation(address user) external view returns (
        int256 score,
        uint256 successfulOrders,
        uint256 failedOrders,
        uint256 totalOrders,
        bool isVerified
    ) {
        UserReputation memory rep = reputations[user];
        return (rep.score, rep.successfulOrders, rep.failedOrders, rep.totalOrders, rep.isVerified);
    }
    
    function canUserSell(address user) external view returns (bool) {
        if (reputations[user].totalOrders == 0) {
            return true; // New users can sell (will get initial reputation)
        }
        return reputations[user].score >= MINIMUM_SELLER_REPUTATION;
    }
    
    function getSuccessRate(address user) external view returns (uint256) {
        if (reputations[user].totalOrders == 0) return 0;
        return (reputations[user].successfulOrders * 100) / reputations[user].totalOrders;
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    function setPlatformFee(uint256 newFeePercent) external onlyOwner {
        require(newFeePercent <= 1000, "Fee cannot exceed 10%");
        platformFeePercent = newFeePercent;
    }
    
    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid recipient address");
        feeRecipient = newRecipient;
    }
    
    function setMinimumReputation(int256 newMinimum) external onlyOwner {
        // Note: This would need to be a storage variable, not constant
        // For now, minimum is fixed at 0
        revert("Minimum reputation is fixed");
    }
    
    /**
     * @dev Emergency withdrawal (owner only)
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
}
