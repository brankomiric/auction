//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";

struct Product {
    uint256 initalPrice;
    address seller;
    string url;
    uint256 startDate;
    uint256 endDate;
    address topBidder;
    uint256 topBid;
}

struct Bid {
    address bidder;
    uint256 amount;
    string auctionId;
}

contract Auction {
    address private owner;
    mapping(string => Product) private products;
    Bid[] private bids;

    constructor() {
        owner = msg.sender;
    }

    // Access modifiers
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    // Events
    event OpenBidding(string auctionId);
    event BiddingClosed(string auctionId);
    event NewBid(string auctionId, uint256 amount, address bidder);
    event AuctionCompleted(string url, address winner);

    // Errors
    error BidingNotAllowed(string message);
    error ProductNotFound(string message);
    error BidTooSmall(string message);
    error UnathorizedTransfer(string message);

    function create(
        string memory auctionId,
        uint256 initalPrice,
        address seller,
        string memory url,
        uint256 startDate,
        uint256 endDate
    ) external onlyOwner {
        Product memory product = Product({
            initalPrice: initalPrice,
            seller: seller,
            url: url,
            startDate: startDate,
            endDate: endDate,
            topBidder: address(0),
            topBid: 0
        });
        products[auctionId] = product;
    }

    function openBidding(string memory auctionId) external onlyOwner {
        Product memory product = products[auctionId];
        if (product.seller == address(0)) {
            revert ProductNotFound(
                "Could not find a product with the given auction id"
            );
        }

        checkIfAuctionAllowed(product);
        emit OpenBidding(auctionId);
    }

    function closeBidding(string memory auctionId) external onlyOwner {
        Product memory product = products[auctionId];
        if (product.seller == address(0)) {
            revert ProductNotFound(
                "Could not find a product with the given auction id "
            );
        }

        require(block.timestamp >= product.endDate);
        emit BiddingClosed(auctionId);
    }

    function bid(uint256 amount, string memory auctionId)
        external
        returns (bool)
    {
        Product memory product = products[auctionId];
        if (product.seller == address(0)) {
            revert ProductNotFound(
                "Could not find a product with the given auction id "
            );
        }
        checkIfAuctionAllowed(product);

        if (amount < product.initalPrice || amount < product.topBid) {
            revert BidTooSmall("Bid lesser than the current top bid");
        }

        product.topBid = amount;
        product.topBidder = msg.sender;
        products[auctionId] = product;

        Bid memory newBid = Bid({
            auctionId: auctionId,
            amount: amount,
            bidder: msg.sender
        });

        bids.push(newBid);

        emit NewBid(auctionId, amount, msg.sender);

        return true;
    }

    function transfer(string memory auctionId) external payable {
        Product memory product = products[auctionId];
        if (product.seller == address(0)) {
            revert ProductNotFound(
                "Could not find a product with the given auction id"
            );
        }

        require(block.timestamp > product.endDate, "Auction is still live");

        if (product.topBidder != msg.sender) {
            revert UnathorizedTransfer("Unauthorized access");
        }

        require(product.topBid == msg.value);
        payable(address(this)).transfer(product.topBid);

        emit AuctionCompleted(product.url, msg.sender);
    }

    function fundSeller(string memory auctionId) external onlyOwner {
        Product memory product = products[auctionId];
        payable(product.seller).transfer(product.topBid);
    }

    function checkIfAuctionAllowed(Product memory product) private view {
        require(
            block.timestamp > product.startDate,
            "Auction hasn't begun yet"
        );
        require(block.timestamp < product.endDate, "Auction is over");
    }

    fallback() external payable {}

    receive() external payable {}
}
