// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IZKMarketplace {
    enum OrderStatus { Created, Funded, Confirmed, Disputed, Resolved, Cancelled }
    
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
    
    function getOrder(uint256 orderId) external view returns (Order memory);
}

contract DisputeResolution {
    // Events
    event DisputeRaised(
        uint256 indexed orderId,
        address indexed disputer,
        string reason,
        string evidenceHash,
        uint256 timestamp
    );
    
    event EvidenceSubmitted(
        uint256 indexed orderId,
        address indexed submitter,
        string evidenceHash,
        string description,
        uint256 timestamp
    );
    
    event DisputeResolved(
        uint256 indexed orderId,
        address indexed winner,
        string resolution,
        uint256 timestamp
    );
    
    event ArbitratorAdded(address indexed arbitrator);
    event ArbitratorRemoved(address indexed arbitrator);

    // Enums
    enum DisputeStatus {
        Open,
        UnderReview,
        Resolved,
        Cancelled
    }

    // Structs
    struct Dispute {
        uint256 orderId;
        address disputer;
        string reason;
        string evidenceHash;
        DisputeStatus status;
        address winner;
        string resolution;
        uint256 createdAt;
        uint256 resolvedAt;
    }
    
    struct Evidence {
        address submitter;
        string hash;
        string description;
        uint256 timestamp;
    }

    // State variables
    address public owner;
    address public mainArbitrator;
    IZKMarketplace public marketplace;
    uint256 public disputeFee = 0.01 ether;
    
    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => Evidence[]) public orderEvidence;
    mapping(address => bool) public authorizedArbitrators;
    mapping(uint256 => bool) public hasDispute;
    
    uint256 public totalDisputes;
    uint256 public resolvedDisputes;

    constructor(address _marketplace, address _mainArbitrator) {
        owner = msg.sender;
        marketplace = IZKMarketplace(_marketplace);
        mainArbitrator = _mainArbitrator;
        authorizedArbitrators[_mainArbitrator] = true;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }
    
    modifier onlyArbitrator() {
        require(authorizedArbitrators[msg.sender], "Not an authorized arbitrator");
        _;
    }
    
    modifier onlyOrderParticipant(uint256 orderId) {
        IZKMarketplace.Order memory order = marketplace.getOrder(orderId);
        require(
            msg.sender == order.seller || msg.sender == order.buyer,
            "Not an order participant"
        );
        _;
    }

    // Dispute Creation
    function raiseDispute(
        uint256 orderId,
        string memory reason,
        string memory evidenceHash
    ) external payable onlyOrderParticipant(orderId) {
        require(msg.value >= disputeFee, "Insufficient dispute fee");
        require(!hasDispute[orderId], "Dispute already exists for this order");
        require(bytes(reason).length > 0, "Reason cannot be empty");
        require(bytes(evidenceHash).length > 0, "Evidence hash required");
        
        IZKMarketplace.Order memory order = marketplace.getOrder(orderId);
        require(
            order.status == IZKMarketplace.OrderStatus.Funded ||
            order.status == IZKMarketplace.OrderStatus.Confirmed,
            "Order not in valid status for dispute"
        );
        
        disputes[orderId] = Dispute({
            orderId: orderId,
            disputer: msg.sender,
            reason: reason,
            evidenceHash: evidenceHash,
            status: DisputeStatus.Open,
            winner: address(0),
            resolution: "",
            createdAt: block.timestamp,
            resolvedAt: 0
        });
        
        hasDispute[orderId] = true;
        totalDisputes++;
        
        // Store initial evidence
        orderEvidence[orderId].push(Evidence({
            submitter: msg.sender,
            hash: evidenceHash,
            description: reason,
            timestamp: block.timestamp
        }));
        
        emit DisputeRaised(orderId, msg.sender, reason, evidenceHash, block.timestamp);
        
        // Refund excess dispute fee
        if (msg.value > disputeFee) {
            payable(msg.sender).transfer(msg.value - disputeFee);
        }
    }

    // Evidence Management
    function submitEvidence(
        uint256 orderId,
        string memory evidenceHash,
        string memory description
    ) external onlyOrderParticipant(orderId) {
        require(hasDispute[orderId], "No dispute exists for this order");
        require(
            disputes[orderId].status == DisputeStatus.Open ||
            disputes[orderId].status == DisputeStatus.UnderReview,
            "Dispute not accepting evidence"
        );
        require(bytes(evidenceHash).length > 0, "Evidence hash required");
        require(bytes(description).length > 0, "Description required");
        
        orderEvidence[orderId].push(Evidence({
            submitter: msg.sender,
            hash: evidenceHash,
            description: description,
            timestamp: block.timestamp
        }));
        
        emit EvidenceSubmitted(orderId, msg.sender, evidenceHash, description, block.timestamp);
    }

    // Arbitration System
    function resolveDispute(
        uint256 orderId,
        address winner,
        string memory resolution
    ) external onlyArbitrator {
        require(hasDispute[orderId], "No dispute exists for this order");
        Dispute storage dispute = disputes[orderId];
        require(
            dispute.status == DisputeStatus.Open ||
            dispute.status == DisputeStatus.UnderReview,
            "Dispute already resolved or cancelled"
        );
        require(bytes(resolution).length > 0, "Resolution explanation required");
        
        IZKMarketplace.Order memory order = marketplace.getOrder(orderId);
        require(
            winner == order.seller || winner == order.buyer,
            "Winner must be order participant"
        );
        
        dispute.status = DisputeStatus.Resolved;
        dispute.winner = winner;
        dispute.resolution = resolution;
        dispute.resolvedAt = block.timestamp;
        resolvedDisputes++;
        
        // Calculate funds distribution (order amount * 2 minus platform fee)
        uint256 totalFunds = order.amount * 2;
        uint256 platformFee = (totalFunds * 250) / 10000; // 2.5% platform fee
        uint256 winnerAmount = totalFunds - platformFee - disputeFee;
        
        // Transfer funds to winner
        payable(winner).transfer(winnerAmount);
        
        emit DisputeResolved(orderId, winner, resolution, block.timestamp);
    }
    
    function setDisputeUnderReview(uint256 orderId) external onlyArbitrator {
        require(hasDispute[orderId], "No dispute exists for this order");
        require(disputes[orderId].status == DisputeStatus.Open, "Dispute not in Open status");
        
        disputes[orderId].status = DisputeStatus.UnderReview;
    }

    // Access Control Functions
    function addArbitrator(address arbitrator) external onlyOwner {
        require(arbitrator != address(0), "Invalid arbitrator address");
        require(!authorizedArbitrators[arbitrator], "Already an arbitrator");
        
        authorizedArbitrators[arbitrator] = true;
        emit ArbitratorAdded(arbitrator);
    }
    
    function removeArbitrator(address arbitrator) external onlyOwner {
        require(arbitrator != mainArbitrator, "Cannot remove main arbitrator");
        require(authorizedArbitrators[arbitrator], "Not an arbitrator");
        
        authorizedArbitrators[arbitrator] = false;
        emit ArbitratorRemoved(arbitrator);
    }
    
    function setMainArbitrator(address newArbitrator) external onlyOwner {
        require(newArbitrator != address(0), "Invalid arbitrator address");
        
        // Remove old main arbitrator if different
        if (mainArbitrator != newArbitrator) {
            authorizedArbitrators[mainArbitrator] = false;
        }
        
        mainArbitrator = newArbitrator;
        authorizedArbitrators[newArbitrator] = true;
    }

    // Administrative Functions
    function setDisputeFee(uint256 newFee) external onlyOwner {
        require(newFee > 0, "Fee must be greater than 0");
        require(newFee <= 0.1 ether, "Fee too high");
        disputeFee = newFee;
    }
    
    function cancelDispute(uint256 orderId) external onlyOwner {
        require(hasDispute[orderId], "No dispute exists for this order");
        Dispute storage dispute = disputes[orderId];
        require(dispute.status != DisputeStatus.Resolved, "Cannot cancel resolved dispute");
        
        dispute.status = DisputeStatus.Cancelled;
        
        // Refund dispute fee to disputer
        payable(dispute.disputer).transfer(disputeFee);
    }

    // Emergency withdrawal function
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(owner).transfer(balance);
    }
    
    function withdrawDisputeFees(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        payable(owner).transfer(amount);
    }

    // View Functions
    function getDispute(uint256 orderId) external view returns (Dispute memory) {
        require(hasDispute[orderId], "No dispute exists for this order");
        return disputes[orderId];
    }
    
    function getEvidence(uint256 orderId) external view returns (Evidence[] memory) {
        return orderEvidence[orderId];
    }
    
    function getEvidenceCount(uint256 orderId) external view returns (uint256) {
        return orderEvidence[orderId].length;
    }
    
    function isArbitrator(address account) external view returns (bool) {
        return authorizedArbitrators[account];
    }
    
    function getDisputeStats() external view returns (
        uint256 total,
        uint256 resolved,
        uint256 open,
        uint256 underReview
    ) {
        return (
            totalDisputes,
            resolvedDisputes,
            totalDisputes - resolvedDisputes,
            0 // This would require iterating through all disputes
        );
    }

    // Receive function to accept ETH
    receive() external payable {}
}

