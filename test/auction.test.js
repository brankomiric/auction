const { expect, assert } = require("chai");
const { ethers, network } = require("hardhat");
const { utils, Contract } = require("ethers");
const { v4: uuidv4 } = require("uuid");

const abi = [
  "function create(string memory auctionId, uint256 initalPrice, address seller, string memory url, uint256 startDate, uint256 endDate)",
  "function openBidding(string memory auctionId)",
  "function closeBidding(string memory auctionId)",
  "function bid(uint256 amount, string memory auctionId) returns (bool)",
  "function transfer(string memory auctionId) payable",
  "function fundSeller(string memory auctionId)",
  "event OpenBidding(string auctionId)",
  "event BiddingClosed(string auctionId)",
  "event NewBid(string auctionId, uint256 amount, address bidder)",
  "event AuctionCompleted(string url, address winner)",
];

describe("Auction", function () {
  it("Should create an auction product for the contract owner", async function () {
    const [owner] = await ethers.getSigners();

    const signers = await ethers.getSigners();
    const seller = signers[1];

    const auctionAddr = await deployAuctionContract();

    // Owner inits the contract
    const auctionContract = await initAuctionContract(owner, auctionAddr);

    const hourInSec = 3600;
    const current = await getCurrentBlockTimestamp();

    const createTx = await auctionContract.create(
      uuidv4(),
      utils.parseEther("1"),
      seller.address,
      "https://solsea.io/n/EJdViVXjKsVRXBJA8oT6WqoC5zvZ8yLzouDZ2RuSJv6F/",
      current + hourInSec,
      current + hourInSec * 2
    );
    const res = await createTx.wait(1);
    expect(res).to.not.be.null;
  });

  it("Should fail to create an auction product if not the contract owner", async function () {
    const signers = await ethers.getSigners();
    const seller = signers[1];

    const auctionAddr = await deployAuctionContract();

    // Non owner inits the contract
    const auctionContract = await initAuctionContract(seller, auctionAddr);

    const hourInSec = 3600;
    const current = await getCurrentBlockTimestamp();

    let errorMessage;
    try {
      const createTx = await auctionContract.create(
        uuidv4(),
        utils.parseEther("1"),
        seller.address,
        "https://solsea.io/n/EJdViVXjKsVRXBJA8oT6WqoC5zvZ8yLzouDZ2RuSJv6F/",
        current + hourInSec,
        current + hourInSec * 2,
        {
          gasLimit: 100000,
        }
      );
      await createTx.wait(1);
    } catch (err) {
      errorMessage = err.toString();
    }
    expect(errorMessage).to.contain("Transaction reverted");
  });

  it("Should fire OpenBidding event if auction exists", async () => {
    const [owner] = await ethers.getSigners();

    const signers = await ethers.getSigners();
    const seller = signers[1];

    const auctionAddr = await deployAuctionContract();

    const auctionContract = await initAuctionContract(owner, auctionAddr);

    const auctionId = uuidv4();
    const hourInSec = 3600;
    const current = await getCurrentBlockTimestamp();

    const createTx = await auctionContract.create(
      auctionId,
      utils.parseEther("1"),
      seller.address,
      "https://solsea.io/n/EJdViVXjKsVRXBJA8oT6WqoC5zvZ8yLzouDZ2RuSJv6F/",
      current + hourInSec,
      current + hourInSec * 2
    );
    await createTx.wait(1);

    // Increase block time so the auction can start
    await increaseBlockTime(3600 + 1);

    await expect(auctionContract.openBidding(auctionId, { gasLimit: 100000 }))
      .to.emit(auctionContract, "OpenBidding")
      .withArgs(auctionId);
  });

  it("Should fail to fire OpenBidding event if auction isn't oppened yet", async () => {
    const [owner] = await ethers.getSigners();

    const signers = await ethers.getSigners();
    const seller = signers[1];

    const auctionAddr = await deployAuctionContract();

    const auctionContract = await initAuctionContract(owner, auctionAddr);

    const auctionId = uuidv4();
    const hourInSec = 3600;
    const current = await getCurrentBlockTimestamp();

    const createTx = await auctionContract.create(
      auctionId,
      utils.parseEther("1"),
      seller.address,
      "https://solsea.io/n/EJdViVXjKsVRXBJA8oT6WqoC5zvZ8yLzouDZ2RuSJv6F/",
      current + hourInSec,
      current + hourInSec * 2
    );
    await createTx.wait(1);

    let errorMessage;
    try {
      const tx = await auctionContract.openBidding(auctionId, {
        gasLimit: 100000,
      });
      await tx.wait(1);
    } catch (err) {
      errorMessage = err.toString();
    }

    expect(errorMessage).to.contain("Auction hasn't begun yet");
  });

  it("Should fire BiddingClosed event if auction exists and auction time has expired", async () => {
    const [owner] = await ethers.getSigners();

    const signers = await ethers.getSigners();
    const seller = signers[1];

    const auctionAddr = await deployAuctionContract();

    const auctionContract = await initAuctionContract(owner, auctionAddr);

    const auctionId = uuidv4();
    const hourInSec = 3600;
    const current = await getCurrentBlockTimestamp();

    const createTx = await auctionContract.create(
      auctionId,
      utils.parseEther("1"),
      seller.address,
      "https://solsea.io/n/EJdViVXjKsVRXBJA8oT6WqoC5zvZ8yLzouDZ2RuSJv6F/",
      current + hourInSec,
      current + hourInSec * 2
    );
    await createTx.wait(1);

    // Increase block time so the auction is over
    await increaseBlockTime(2 * 3600 + 1);

    await expect(auctionContract.closeBidding(auctionId, { gasLimit: 100000 }))
      .to.emit(auctionContract, "BiddingClosed")
      .withArgs(auctionId);
  });

  it("Should fail to fire BiddingClosed event if auction isn't over yet", async () => {
    const [owner] = await ethers.getSigners();

    const signers = await ethers.getSigners();
    const seller = signers[1];

    const auctionAddr = await deployAuctionContract();

    const auctionContract = await initAuctionContract(owner, auctionAddr);

    const auctionId = uuidv4();
    const hourInSec = 3600;
    const current = await getCurrentBlockTimestamp();

    const createTx = await auctionContract.create(
      auctionId,
      utils.parseEther("1"),
      seller.address,
      "https://solsea.io/n/EJdViVXjKsVRXBJA8oT6WqoC5zvZ8yLzouDZ2RuSJv6F/",
      current + hourInSec,
      current + hourInSec * 2
    );
    await createTx.wait(1);

    await increaseBlockTime(3600 + 1);

    let errorMessage;
    try {
      const tx = await auctionContract.closeBidding(auctionId, {
        gasLimit: 100000,
      });
      await tx.wait(1);
    } catch (err) {
      errorMessage = err.toString();
    }

    expect(errorMessage).to.contain("Error: Transaction reverted");
  });

  it("Should be possible to bid if auction exists and is started", async () => {
    const [owner] = await ethers.getSigners();

    const signers = await ethers.getSigners();
    const seller = signers[1];

    const auctionAddr = await deployAuctionContract();

    const auctionContract = await initAuctionContract(owner, auctionAddr);

    const auctionId = uuidv4();
    const hourInSec = 3600;
    const current = await getCurrentBlockTimestamp();

    const createTx = await auctionContract.create(
      auctionId,
      utils.parseEther("1"),
      seller.address,
      "https://solsea.io/n/EJdViVXjKsVRXBJA8oT6WqoC5zvZ8yLzouDZ2RuSJv6F/",
      current + hourInSec,
      current + hourInSec * 2
    );
    await createTx.wait(1);

    // Auction is active
    await increaseBlockTime(3600 + 1);

    const auctionContractBidder1 = await initAuctionContract(
      signers[2],
      auctionAddr
    );

    // Should succeed as the bid is higher than inital bid
    let bidTx = await auctionContractBidder1.bid(
      utils.parseEther("2"),
      auctionId
    );
    await bidTx.wait(1);

    // Successful bid should fire NewBid event
    await expect(auctionContractBidder1.bid(utils.parseEther("2.1"), auctionId))
      .to.emit(auctionContract, "NewBid")
      .withArgs(auctionId, utils.parseEther("2.1"), signers[2].address);

    // Should fail as the bid is lesser than the top bid
    let errorMessage;
    try {
      bidTx = await auctionContractBidder1.bid(
        utils.parseEther("1.5"),
        auctionId,
        { gasLimit: 100000 }
      );
      await bidTx.wait(1);
    } catch (err) {
      errorMessage = err.toString();
    }

    expect(errorMessage).to.contain(
      'BidTooSmall("Bid lesser than the current top bid")'
    );
  });

  it("Should be possible for auction winner to transfer eth to the contract", async () => {
    const [owner] = await ethers.getSigners();

    const signers = await ethers.getSigners();
    const seller = signers[1];

    const auctionAddr = await deployAuctionContract();

    const auctionContract = await initAuctionContract(owner, auctionAddr);

    const auctionId = uuidv4();
    const hourInSec = 3600;
    const current = await getCurrentBlockTimestamp();

    const createTx = await auctionContract.create(
      auctionId,
      utils.parseEther("1"),
      seller.address,
      "https://solsea.io/n/EJdViVXjKsVRXBJA8oT6WqoC5zvZ8yLzouDZ2RuSJv6F/",
      current + hourInSec,
      current + hourInSec * 2
    );
    await createTx.wait(1);

    // Auction is active
    await increaseBlockTime(3600 + 1);

    const auctionContractBidder1 = await initAuctionContract(
      signers[2],
      auctionAddr
    );

    let bidTx = await auctionContractBidder1.bid(
      utils.parseEther("2"),
      auctionId
    );
    await bidTx.wait(1);

    const auctionContractBidder2 = await initAuctionContract(
      signers[3],
      auctionAddr
    );

    bidTx = await auctionContractBidder2.bid(
      utils.parseEther("2.5"),
      auctionId
    );
    await bidTx.wait(1);

    // Auction is over
    await increaseBlockTime(2 * 3600 + 1);

    // Assert AuctionCompleted event fired
    await expect(
      auctionContractBidder2.transfer(auctionId, {
        value: utils.parseEther("2.5"),
      })
    )
      .to.emit(auctionContract, "AuctionCompleted")
      .withArgs(
        "https://solsea.io/n/EJdViVXjKsVRXBJA8oT6WqoC5zvZ8yLzouDZ2RuSJv6F/",
        signers[3].address
      );

    const balance = await signers[3].getBalance();

    const transferTx = await auctionContractBidder2.transfer(auctionId, {
      value: utils.parseEther("2.5"),
      gasLimit: 100000,
    });
    await transferTx.wait(1);

    const newBalance = await signers[3].getBalance();

    // Assert eth transfered
    assert(newBalance.lt(balance));
  });

  it("Shouldn't be possible for anyone else but the auction winner to transfer eth to the contract", async () => {
    const [owner] = await ethers.getSigners();

    const signers = await ethers.getSigners();
    const seller = signers[1];

    const auctionAddr = await deployAuctionContract();

    const auctionContract = await initAuctionContract(owner, auctionAddr);

    const auctionId = uuidv4();
    const hourInSec = 3600;
    const current = await getCurrentBlockTimestamp();

    const createTx = await auctionContract.create(
      auctionId,
      utils.parseEther("1"),
      seller.address,
      "https://solsea.io/n/EJdViVXjKsVRXBJA8oT6WqoC5zvZ8yLzouDZ2RuSJv6F/",
      current + hourInSec,
      current + hourInSec * 2
    );
    await createTx.wait(1);

    // Auction is active
    await increaseBlockTime(3600 + 1);

    const auctionContractBidder1 = await initAuctionContract(
      signers[2],
      auctionAddr
    );

    let bidTx = await auctionContractBidder1.bid(
      utils.parseEther("2"),
      auctionId
    );
    await bidTx.wait(1);

    const auctionContractBidder2 = await initAuctionContract(
      signers[3],
      auctionAddr
    );

    bidTx = await auctionContractBidder2.bid(
      utils.parseEther("2.5"),
      auctionId
    );
    await bidTx.wait(1);

    // Auction is over
    await increaseBlockTime(2 * 3600 + 1);

    let errorMessage;
    try {
      // Bidder tries to fund the contract although not being the auction winner
      const transferTx = await auctionContractBidder1.transfer(auctionId, {
        value: utils.parseEther("2.5"),
        gasLimit: 100000,
      });
      await transferTx.wait(1);
    } catch (err) {
      errorMessage = err.toString();
    }

    expect(errorMessage).to.contain(
      'UnathorizedTransfer("Unauthorized access")'
    );
  });

  it("Should be possible for contract owner to transfer funds to seller if auction is over", async () => {
    const [owner] = await ethers.getSigners();

    const signers = await ethers.getSigners();
    const seller = signers[1];

    const auctionAddr = await deployAuctionContract();

    const auctionContract = await initAuctionContract(owner, auctionAddr);

    const auctionId = uuidv4();
    const hourInSec = 3600;
    const current = await getCurrentBlockTimestamp();

    const createTx = await auctionContract.create(
      auctionId,
      utils.parseEther("1"),
      seller.address,
      "https://solsea.io/n/EJdViVXjKsVRXBJA8oT6WqoC5zvZ8yLzouDZ2RuSJv6F/",
      current + hourInSec,
      current + hourInSec * 2
    );
    await createTx.wait(1);

    // Auction is active
    await increaseBlockTime(3600 + 1);

    const auctionContractBidder1 = await initAuctionContract(
      signers[2],
      auctionAddr
    );

    let bidTx = await auctionContractBidder1.bid(
      utils.parseEther("2"),
      auctionId
    );
    await bidTx.wait(1);

    const auctionContractBidder2 = await initAuctionContract(
      signers[3],
      auctionAddr
    );

    bidTx = await auctionContractBidder2.bid(
      utils.parseEther("2.5"),
      auctionId
    );
    await bidTx.wait(1);

    // Auction is over
    await increaseBlockTime(2 * 3600 + 1);

    // Assert AuctionCompleted event fired
    await expect(
      auctionContractBidder2.transfer(auctionId, {
        value: utils.parseEther("2.5"),
      })
    )
      .to.emit(auctionContract, "AuctionCompleted")
      .withArgs(
        "https://solsea.io/n/EJdViVXjKsVRXBJA8oT6WqoC5zvZ8yLzouDZ2RuSJv6F/",
        signers[3].address
      );

    const balance = await signers[3].getBalance();

    const transferTx = await auctionContractBidder2.transfer(auctionId, {
      value: utils.parseEther("2.5"),
      gasLimit: 100000,
    });
    await transferTx.wait(1);

    const newBalance = await signers[3].getBalance();

    // Assert eth transfered for the bidder
    assert(newBalance.lt(balance));

    const sellerBalance = await seller.getBalance();
    const tx = await auctionContract.fundSeller(auctionId);
    await tx.wait(1);

    const sellerNewBalance = await seller.getBalance();

    // Asser seller was funded with correct eth amount
    assert(sellerBalance.add(utils.parseEther("2.5")).eq(sellerNewBalance));
  });
});

const deployAuctionContract = async () => {
  const Contract = await ethers.getContractFactory("Auction");
  const contract = await Contract.deploy();
  return contract.address;
};

const initAuctionContract = async (signer, address) => {
  return new Contract(address, abi, signer);
};

const increaseBlockTime = async (seconds) => {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
};

const getCurrentBlockTimestamp = async () => {
  const currentBlock = await ethers.provider.getBlock();
  return currentBlock.timestamp;
};
