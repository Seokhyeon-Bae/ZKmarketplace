// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ZKMarketplace {
    // Events
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

    // Structs
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
    
    // Enums
    enum OrderStatus {
        Created,
        Funded,
        Confirmed,
        Disputed,
        Resolved,
        Cancelled
    }

    // State variables
    uint256 public nextOrderId;
    uint256 public platformFeePercent = 250; // 2.5% (250/10000)
    address public feeRecipient;
    address public owner;
    
    mapping(uint256 => Order) public orders;

    constructor(address _feeRecipient) {
        feeRecipient = _feeRecipient;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    // Core marketplace functions
    function createOrder(
        string memory description
    ) external payable returns (uint256) {
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
    
    function fundOrder(uint256 orderId) external payable {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.Created, "Order not in correct status");
        require(msg.value == order.amount, "Incorrect funding amount");
        require(msg.sender != order.seller, "Seller cannot fund their own order");
        
        order.buyer = msg.sender;
        order.status = OrderStatus.Funded;
        order.fundedAt = block.timestamp;
        
        emit OrderFunded(orderId, msg.sender, msg.value, block.timestamp);
    }
    
    function confirmReceipt(uint256 orderId) external {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.Funded, "Order not funded");
        require(msg.sender == order.buyer, "Only buyer can confirm receipt");
        
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
    
    // View functions
    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }
    
    function getOrderStatus(uint256 orderId) external view returns (OrderStatus) {
        return orders[orderId].status;
    }
    
    // Admin functions
    function setPlatformFee(uint256 newFeePercent) external onlyOwner {
        require(newFeePercent <= 1000, "Fee cannot exceed 10%");
        platformFeePercent = newFeePercent;
    }
    
    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid recipient address");
        feeRecipient = newRecipient;
    }
}
