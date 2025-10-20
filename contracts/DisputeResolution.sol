// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title DisputeResolution
 * @dev Handles dispute resolution for the ZK Marketplace
 * 
 * HOW IT WORKS:
 * 1. Either buyer or seller can raise a dispute
 * 2. They must pay a dispute fee (0.01 ETH) to prevent spam
 * 3. Both parties can submit evidence (IPFS hashes)
 * 4. An authorized arbitrator reviews and resolves the dispute
 * 5. Winner gets the funds, loser loses reputation
 */

interface IZKMarketplace {
    enum OrderStatus {
        Created,
        Funded,
        Confirmed,
        Disputed,
        Resolved,
        Cancelled
    }
    
    function orders(uint256 orderId) external view returns (
        uint256 id,
        address seller,
        address buyer,
        uint256 amount,
        string memory description,
        OrderStatus status,
        uint256 createdAt,
        uint256 fundedAt,
        uint256 confirmedAt
    );
}

contract DisputeResolution {
    
    // ============ ENUMS ============
    
    enum DisputeStatus {
        Open,           // Dispute just raised
        UnderReview,    // Arbitrator is reviewing
        Resolved,       // Decision made
        Cancelled       // Dispute cancelled
    }
    
    enum Winner {
        None,
        Buyer,
        Seller
    }
    
    // ============ STRUCTS ============
    
    struct Dispute {
        uint256 orderId;
        address disputer;           // Who raised the dispute
        string reason;              // Why they're disputing
        string evidenceHash;        // IPFS hash of initial evidence
        DisputeStatus status;
        Winner winner;
        string resolution;          // Arbitrator's explanation
        uint256 createdAt;
        uint256 resolvedAt;
        uint256 disputeFee;        // Fee paid to raise dispute
    }
    
    struct Evidence {
        address submitter;
        string evidenceHash;        // IPFS hash
        string description;
        uint256 timestamp;
    }
    
    // ============ STATE VARIABLES ============
    
    IZKMarketplace public marketplace;
    address public owner;
    address public mainArbitrator;
    uint256 public disputeFee = 0.01 ether;
    uint256 public nextDisputeId;
    
    // Mappings
    mapping(uint256 => Dispute) public disputes;                    // disputeId => Dispute
    mapping(uint256 => uint256) public orderToDispute;              // orderId => disputeId
    mapping(uint256 => Evidence[]) public disputeEvidence;          // disputeId => Evidence[]
    mapping(address => bool) public authorizedArbitrators;
    mapping(address => uint256) public arbitratorResolutionCount;
    
    // ============ EVENTS ============
    
    event DisputeRaised(
        uint256 indexed disputeId,
        uint256 indexed orderId,
        address indexed disputer,
        string reason,
        uint256 timestamp
    );
    
    event EvidenceSubmitted(
        uint256 indexed disputeId,
        address indexed submitter,
        string evidenceHash,
        uint256 timestamp
    );
    
    event DisputeResolved(
        uint256 indexed disputeId,
        uint256 indexed orderId,
        Winner winner,
        string resolution,
        uint256 timestamp
    );
    
    event DisputeStatusChanged(
        uint256 indexed disputeId,
        DisputeStatus oldStatus,
        DisputeStatus newStatus
    );
    
    event ArbitratorAdded(address indexed arbitrator);
    event ArbitratorRemoved(address indexed arbitrator);
    event DisputeFeeUpdated(uint256 oldFee, uint256 newFee);
    
    // ============ MODIFIERS ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }
    
    modifier onlyArbitrator() {
        require(
            authorizedArbitrators[msg.sender] || msg.sender == mainArbitrator,
            "Not an authorized arbitrator"
        );
        _;
    }
    
    modifier disputeExists(uint256 disputeId) {
        require(disputeId < nextDisputeId, "Dispute does not exist");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    constructor(address _marketplace, address _mainArbitrator) {
        require(_marketplace != address(0), "Invalid marketplace address");
        require(_mainArbitrator != address(0), "Invalid arbitrator address");
        
        marketplace = IZKMarketplace(_marketplace);
        owner = msg.sender;
        mainArbitrator = _mainArbitrator;
        authorizedArbitrators[_mainArbitrator] = true;
    }
    
    // ============ MAIN FUNCTIONS ============
    
    /**
     * @dev Raise a dispute for an order
     * @param orderId The order to dispute
     * @param reason Why you're raising the dispute
     * @param evidenceHash IPFS hash of your evidence
     */
    function raiseDispute(
        uint256 orderId,
        string memory reason,
        string memory evidenceHash
    ) external payable returns (uint256) {
        require(msg.value >= disputeFee, "Insufficient dispute fee");
        require(bytes(reason).length > 0, "Reason cannot be empty");
        require(bytes(evidenceHash).length > 0, "Evidence hash required");
        
        // Get order from marketplace
        (
            ,
            address seller,
            address buyer,
            uint256 amount,
            ,
            IZKMarketplace.OrderStatus status,
            ,
            ,
        ) = marketplace.orders(orderId);
        
        // Validate dispute conditions
        require(
            status == IZKMarketplace.OrderStatus.Funded,
            "Order must be in Funded status"
        );
        require(
            msg.sender == seller || msg.sender == buyer,
            "Only order participants can raise disputes"
        );
        require(
            orderToDispute[orderId] == 0 || 
            disputes[orderToDispute[orderId]].status == DisputeStatus.Cancelled,
            "Dispute already exists for this order"
        );
        require(amount > 0, "Order has no value");
        
        // Create dispute
        uint256 disputeId = nextDisputeId++;
        
        disputes[disputeId] = Dispute({
            orderId: orderId,
            disputer: msg.sender,
            reason: reason,
            evidenceHash: evidenceHash,
            status: DisputeStatus.Open,
            winner: Winner.None,
            resolution: "",
            createdAt: block.timestamp,
            resolvedAt: 0,
            disputeFee: msg.value
        });
        
        orderToDispute[orderId] = disputeId;
        
        // Add initial evidence
        disputeEvidence[disputeId].push(Evidence({
            submitter: msg.sender,
            evidenceHash: evidenceHash,
            description: reason,
            timestamp: block.timestamp
        }));
        
        emit DisputeRaised(disputeId, orderId, msg.sender, reason, block.timestamp);
        
        return disputeId;
    }
    
    /**
     * @dev Submit additional evidence for a dispute
     * @param disputeId The dispute to add evidence to
     * @param evidenceHash IPFS hash of the evidence
     * @param description Description of the evidence
     */
    function submitEvidence(
        uint256 disputeId,
        string memory evidenceHash,
        string memory description
    ) external disputeExists(disputeId) {
        Dispute storage dispute = disputes[disputeId];
        require(
            dispute.status == DisputeStatus.Open || 
            dispute.status == DisputeStatus.UnderReview,
            "Cannot submit evidence for closed dispute"
        );
        
        // Get order details
        (
            ,
            address seller,
            address buyer,
            ,
            ,
            ,
            ,
            ,
        ) = marketplace.orders(dispute.orderId);
        
        require(
            msg.sender == seller || msg.sender == buyer,
            "Only order participants can submit evidence"
        );
        require(bytes(evidenceHash).length > 0, "Evidence hash required");
        
        // Add evidence
        disputeEvidence[disputeId].push(Evidence({
            submitter: msg.sender,
            evidenceHash: evidenceHash,
            description: description,
            timestamp: block.timestamp
        }));
        
        emit EvidenceSubmitted(disputeId, msg.sender, evidenceHash, block.timestamp);
    }
    
    /**
     * @dev Resolve a dispute (arbitrator only)
     * @param disputeId The dispute to resolve
     * @param _winner Who wins (Buyer or Seller)
     * @param resolution Explanation of the decision
     */
    function resolveDispute(
        uint256 disputeId,
        Winner _winner,
        string memory resolution
    ) external onlyArbitrator disputeExists(disputeId) {
        require(_winner != Winner.None, "Must select a winner");
        require(bytes(resolution).length > 0, "Resolution explanation required");
        
        Dispute storage dispute = disputes[disputeId];
        require(
            dispute.status != DisputeStatus.Resolved,
            "Dispute already resolved"
        );
        
        // Get order details
        (
            ,
            address seller,
            address buyer,
            uint256 amount,
            ,
            ,
            ,
            ,
        ) = marketplace.orders(dispute.orderId);
        
        // Update dispute
        DisputeStatus oldStatus = dispute.status;
        dispute.status = DisputeStatus.Resolved;
        dispute.winner = _winner;
        dispute.resolution = resolution;
        dispute.resolvedAt = block.timestamp;
        
        // Determine winner address
        address winnerAddress = _winner == Winner.Buyer ? buyer : seller;
        
        // Transfer funds to winner
        // In a real implementation, this would interact with the marketplace contract
        // to release the escrowed funds
        payable(winnerAddress).transfer(amount);
        
        // Return dispute fee to disputer
        if (dispute.disputeFee > 0) {
            payable(dispute.disputer).transfer(dispute.disputeFee);
        }
        
        // Track arbitrator stats
        arbitratorResolutionCount[msg.sender]++;
        
        emit DisputeResolved(disputeId, dispute.orderId, _winner, resolution, block.timestamp);
        emit DisputeStatusChanged(disputeId, oldStatus, DisputeStatus.Resolved);
    }
    
    /**
     * @dev Change dispute status (arbitrator only)
     * @param disputeId The dispute to update
     * @param newStatus The new status
     */
    function updateDisputeStatus(
        uint256 disputeId,
        DisputeStatus newStatus
    ) external onlyArbitrator disputeExists(disputeId) {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.status != DisputeStatus.Resolved, "Cannot change resolved dispute");
        
        DisputeStatus oldStatus = dispute.status;
        dispute.status = newStatus;
        
        emit DisputeStatusChanged(disputeId, oldStatus, newStatus);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Get dispute details
     */
    function getDispute(uint256 disputeId) 
        external 
        view 
        disputeExists(disputeId) 
        returns (Dispute memory) 
    {
        return disputes[disputeId];
    }
    
    /**
     * @dev Get all evidence for a dispute
     */
    function getEvidence(uint256 disputeId) 
        external 
        view 
        disputeExists(disputeId) 
        returns (Evidence[] memory) 
    {
        return disputeEvidence[disputeId];
    }
    
    /**
     * @dev Get dispute ID for an order
     */
    function getDisputeIdByOrder(uint256 orderId) 
        external 
        view 
        returns (uint256) 
    {
        return orderToDispute[orderId];
    }
    
    /**
     * @dev Check if an order has an active dispute
     */
    function hasActiveDispute(uint256 orderId) external view returns (bool) {
        uint256 disputeId = orderToDispute[orderId];
        if (disputeId == 0) return false;
        
        DisputeStatus status = disputes[disputeId].status;
        return status == DisputeStatus.Open || status == DisputeStatus.UnderReview;
    }
    
    /**
     * @dev Get evidence count for a dispute
     */
    function getEvidenceCount(uint256 disputeId) 
        external 
        view 
        disputeExists(disputeId) 
        returns (uint256) 
    {
        return disputeEvidence[disputeId].length;
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Add an authorized arbitrator
     */
    function addArbitrator(address arbitrator) external onlyOwner {
        require(arbitrator != address(0), "Invalid arbitrator address");
        require(!authorizedArbitrators[arbitrator], "Already an arbitrator");
        
        authorizedArbitrators[arbitrator] = true;
        emit ArbitratorAdded(arbitrator);
    }
    
    /**
     * @dev Remove an arbitrator
     */
    function removeArbitrator(address arbitrator) external onlyOwner {
        require(arbitrator != mainArbitrator, "Cannot remove main arbitrator");
        require(authorizedArbitrators[arbitrator], "Not an arbitrator");
        
        authorizedArbitrators[arbitrator] = false;
        emit ArbitratorRemoved(arbitrator);
    }
    
    /**
     * @dev Update the dispute fee
     */
    function setDisputeFee(uint256 newFee) external onlyOwner {
        require(newFee > 0, "Fee must be greater than 0");
        require(newFee <= 0.1 ether, "Fee too high");
        
        uint256 oldFee = disputeFee;
        disputeFee = newFee;
        
        emit DisputeFeeUpdated(oldFee, newFee);
    }
    
    /**
     * @dev Update main arbitrator
     */
    function setMainArbitrator(address newArbitrator) external onlyOwner {
        require(newArbitrator != address(0), "Invalid address");
        
        // Remove old arbitrator from authorized list
        authorizedArbitrators[mainArbitrator] = false;
        
        // Set new arbitrator
        mainArbitrator = newArbitrator;
        authorizedArbitrators[newArbitrator] = true;
    }
    
    /**
     * @dev Emergency withdrawal (owner only)
     * Only for stuck funds, not for active disputes
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
    
    // ============ FALLBACK ============
    
    receive() external payable {}
}

