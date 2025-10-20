// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ZKMarketplace - PERMISSIONED VERSION
 * @dev This version adds access control - only approved users can participate
 * 
 * PERMISSION LEVELS:
 * 1. Owner - Can manage everything
 * 2. Approved Sellers - Can create orders
 * 3. Approved Buyers - Can fund orders
 * 4. General Public - Can only view (no transactions)
 */

contract ZKMarketplace_Permissioned {
    
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
    
    // NEW: Permission events
    event SellerApproved(address indexed seller, address indexed approvedBy);
    event SellerRevoked(address indexed seller, address indexed revokedBy);
    event BuyerApproved(address indexed buyer, address indexed approvedBy);
    event BuyerRevoked(address indexed buyer, address indexed revokedBy);
    
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
    uint256 public platformFeePercent = 250; // 2.5%
    address public feeRecipient;
    address public owner;
    
    mapping(uint256 => Order) public orders;
    
    // NEW: Permission mappings
    mapping(address => bool) public approvedSellers;
    mapping(address => bool) public approvedBuyers;
    mapping(address => uint256) public sellerApprovalTime;
    mapping(address => uint256) public buyerApprovalTime;
    
    // NEW: Statistics
    uint256 public totalApprovedSellers;
    uint256 public totalApprovedBuyers;
    
    // ============ MODIFIERS ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }
    
    // NEW: Permission modifiers
    modifier onlyApprovedSeller() {
        require(approvedSellers[msg.sender], "Not an approved seller");
        _;
    }
    
    modifier onlyApprovedBuyer() {
        require(approvedBuyers[msg.sender], "Not an approved buyer");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    constructor(address _feeRecipient) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
        owner = msg.sender;
        
        // Owner is automatically approved as both seller and buyer
        approvedSellers[msg.sender] = true;
        approvedBuyers[msg.sender] = true;
        totalApprovedSellers = 1;
        totalApprovedBuyers = 1;
    }
    
    // ============ PERMISSION MANAGEMENT ============
    
    /**
     * @dev Approve a seller (owner only)
     */
    function approveSeller(address seller) external onlyOwner {
        require(seller != address(0), "Invalid address");
        require(!approvedSellers[seller], "Already approved");
        
        approvedSellers[seller] = true;
        sellerApprovalTime[seller] = block.timestamp;
        totalApprovedSellers++;
        
        emit SellerApproved(seller, msg.sender);
    }
    
    /**
     * @dev Revoke seller approval (owner only)
     */
    function revokeSeller(address seller) external onlyOwner {
        require(seller != owner, "Cannot revoke owner");
        require(approvedSellers[seller], "Not an approved seller");
        
        approvedSellers[seller] = false;
        totalApprovedSellers--;
        
        emit SellerRevoked(seller, msg.sender);
    }
    
    /**
     * @dev Approve a buyer (owner only)
     */
    function approveBuyer(address buyer) external onlyOwner {
        require(buyer != address(0), "Invalid address");
        require(!approvedBuyers[buyer], "Already approved");
        
        approvedBuyers[buyer] = true;
        buyerApprovalTime[buyer] = block.timestamp;
        totalApprovedBuyers++;
        
        emit BuyerApproved(buyer, msg.sender);
    }
    
    /**
     * @dev Revoke buyer approval (owner only)
     */
    function revokeBuyer(address buyer) external onlyOwner {
        require(buyer != owner, "Cannot revoke owner");
        require(approvedBuyers[buyer], "Not an approved buyer");
        
        approvedBuyers[buyer] = false;
        totalApprovedBuyers--;
        
        emit BuyerRevoked(buyer, msg.sender);
    }
    
    /**
     * @dev Batch approve multiple sellers
     */
    function batchApproveSellers(address[] calldata sellers) external onlyOwner {
        for (uint256 i = 0; i < sellers.length; i++) {
            if (!approvedSellers[sellers[i]] && sellers[i] != address(0)) {
                approvedSellers[sellers[i]] = true;
                sellerApprovalTime[sellers[i]] = block.timestamp;
                totalApprovedSellers++;
                emit SellerApproved(sellers[i], msg.sender);
            }
        }
    }
    
    /**
     * @dev Batch approve multiple buyers
     */
    function batchApproveBuyers(address[] calldata buyers) external onlyOwner {
        for (uint256 i = 0; i < buyers.length; i++) {
            if (!approvedBuyers[buyers[i]] && buyers[i] != address(0)) {
                approvedBuyers[buyers[i]] = true;
                buyerApprovalTime[buyers[i]] = block.timestamp;
                totalApprovedBuyers++;
                emit BuyerApproved(buyers[i], msg.sender);
            }
        }
    }
    
    /**
     * @dev Approve an address as both seller and buyer
     */
    function approveParticipant(address participant) external onlyOwner {
        require(participant != address(0), "Invalid address");
        
        if (!approvedSellers[participant]) {
            approvedSellers[participant] = true;
            sellerApprovalTime[participant] = block.timestamp;
            totalApprovedSellers++;
            emit SellerApproved(participant, msg.sender);
        }
        
        if (!approvedBuyers[participant]) {
            approvedBuyers[participant] = true;
            buyerApprovalTime[participant] = block.timestamp;
            totalApprovedBuyers++;
            emit BuyerApproved(participant, msg.sender);
        }
    }
    
    // ============ MARKETPLACE FUNCTIONS (NOW PERMISSIONED) ============
    
    /**
     * @dev Create an order - ONLY APPROVED SELLERS
     */
    function createOrder(
        string memory description
    ) external payable onlyApprovedSeller returns (uint256) {
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
     * @dev Fund an order - ONLY APPROVED BUYERS
     */
    function fundOrder(uint256 orderId) external payable onlyApprovedBuyer {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.Created, "Order not in correct status");
        require(msg.value == order.amount, "Incorrect funding amount");
        require(msg.sender != order.seller, "Seller cannot fund their own order");
        
        order.buyer = msg.sender;
        order.status = OrderStatus.Funded;
        order.fundedAt = block.timestamp;
        
        emit OrderFunded(orderId, msg.sender, msg.value, block.timestamp);
    }
    
    /**
     * @dev Confirm receipt - buyer must be approved
     */
    function confirmReceipt(uint256 orderId) external {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.Funded, "Order not funded");
        require(msg.sender == order.buyer, "Only buyer can confirm receipt");
        require(approvedBuyers[msg.sender], "Buyer no longer approved");
        
        order.status = OrderStatus.Confirmed;
        order.confirmedAt = block.timestamp;
        
        // Calculate fees
        uint256 platformFee = (order.amount * platformFeePercent) / 10000;
        uint256 sellerAmount = order.amount - platformFee;
        
        // Transfer funds
        payable(order.seller).transfer(sellerAmount);
        payable(feeRecipient).transfer(platformFee);
        
        emit OrderConfirmed(orderId, order.seller, sellerAmount, block.timestamp);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }
    
    function getOrderStatus(uint256 orderId) external view returns (OrderStatus) {
        return orders[orderId].status;
    }
    
    /**
     * @dev Check if address is approved seller
     */
    function isApprovedSeller(address seller) external view returns (bool) {
        return approvedSellers[seller];
    }
    
    /**
     * @dev Check if address is approved buyer
     */
    function isApprovedBuyer(address buyer) external view returns (bool) {
        return approvedBuyers[buyer];
    }
    
    /**
     * @dev Check if address is approved for both roles
     */
    function isApprovedParticipant(address participant) external view returns (bool, bool) {
        return (approvedSellers[participant], approvedBuyers[participant]);
    }
    
    /**
     * @dev Get approval timestamp for seller
     */
    function getSellerApprovalTime(address seller) external view returns (uint256) {
        return sellerApprovalTime[seller];
    }
    
    /**
     * @dev Get approval timestamp for buyer
     */
    function getBuyerApprovalTime(address buyer) external view returns (uint256) {
        return buyerApprovalTime[buyer];
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
    
    /**
     * @dev Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        
        // Approve new owner as both seller and buyer
        approvedSellers[newOwner] = true;
        approvedBuyers[newOwner] = true;
        
        owner = newOwner;
    }
}


