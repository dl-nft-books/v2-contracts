const { assert } = require("chai");
const { wei, accounts, toBN } = require("../scripts/utils/utils");
const { ZERO_ADDR, PRECISION, PERCENTAGE_100 } = require("../scripts/utils/constants");
const { signBuy, signBuyWithRequest } = require("./helpers/signatures");
const { getCurrentBlockTime, setNextBlockTime } = require("./helpers/block-helper");
const { web3 } = require("hardhat");

const Reverter = require("./helpers/reverter");
const truffleAssert = require("truffle-assertions");

const ContractsRegistry = artifacts.require("ContractsRegistry");
const TokenFactory = artifacts.require("TokenFactory");
const TokenRegistry = artifacts.require("TokenRegistry");
const RoleManager = artifacts.require("RoleManager");
const ERC721MintableToken = artifacts.require("ERC721MintableToken");
const Marketplace = artifacts.require("Marketplace");
const ERC20Mock = artifacts.require("ERC20Mock");
const ERC721Mock = artifacts.require("ERC721Mock");
const ERC721Holder = artifacts.require("ERC721Holder");

TokenRegistry.numberFormat = "BigNumber";
Marketplace.numberFormat = "BigNumber";
ERC721MintableToken.numberFormat = "BigNumber";
ERC20Mock.numberFormat = "BigNumber";

describe("Marketplace", () => {
  const reverter = new Reverter();

  const OWNER_PK = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const USER1_PK = "0e48c6349e2619d39b0f2c19b63e650718903a3146c7fb71f4c7761147b2a10b";

  const priceDecimals = toBN(18);
  const tokenPrice = wei(500);
  const mintTokensAmount = wei(10000);
  const defaultPricePerOneToken = wei(100, priceDecimals);
  const defaultDiscountValue = 0;
  const signDuration = 10000;
  const defaultTokenURI = "some uri";
  const defaultBaseURI = "some base uri";
  const defaultMinNFTFloorPrice = wei(80, priceDecimals);
  const defaultVoucherTokensAmount = wei(1);

  let OWNER;
  let USER1;
  let NOTHING;

  let marketplace;
  let contractsRegistry;
  let paymentToken;
  let nft;

  let defaultVoucherContract;
  let defaultEndTime;

  const PaymentType = {
    NATIVE: 0,
    ERC20: 1,
    NFT: 2,
    VOUCHER: 3,
  };

  const NFTRequestStatus = {
    NONE: 0,
    PENDING: 1,
    MINTED: 2,
    CANCELED: 3,
  };

  function signBuyTest({
    privateKey = OWNER_PK,
    tokenContract = "",
    futureTokenId = 0,
    paymentTokenAddress = paymentToken.address,
    paymentTokenPrice = tokenPrice.toFixed(),
    discount = defaultDiscountValue.toFixed(),
    endTimestamp = defaultEndTime.toFixed(),
    tokenURI = defaultTokenURI,
  }) {
    const buffer = Buffer.from(privateKey, "hex");

    const domain = {
      name: "Marketplace",
      verifyingContract: marketplace.address,
    };

    const buy = {
      tokenContract: tokenContract,
      futureTokenId: futureTokenId,
      paymentTokenAddress: paymentTokenAddress,
      paymentTokenPrice: paymentTokenPrice,
      discount: discount,
      endTimestamp: endTimestamp,
      tokenURI: web3.utils.soliditySha3(tokenURI),
    };

    return signBuy(domain, buy, buffer);
  }

  async function deployERC20(name, symbol, users, decimals = 18) {
    const token = await ERC20Mock.new(name, symbol, decimals);

    for (let i = 0; i < users.length; i++) {
      await token.mint(users[i], mintTokensAmount);
      await token.approve(marketplace.address, mintTokensAmount, { from: users[i] });
    }

    return token;
  }

  function signBuyWithRequestTest({
    privateKey = OWNER_PK,
    requestId = 0,
    futureTokenId = 0,
    endTimestamp = defaultEndTime.toFixed(),
    tokenURI = defaultTokenURI,
  }) {
    const buffer = Buffer.from(privateKey, "hex");

    const domain = {
      name: "Marketplace",
      verifyingContract: marketplace.address,
    };

    const buyWithRequest = {
      requestId: requestId,
      futureTokenId: futureTokenId,
      endTimestamp: endTimestamp,
      tokenURI: web3.utils.soliditySha3(tokenURI),
    };

    return signBuyWithRequest(domain, buyWithRequest, buffer);
  }

  before("setup", async () => {
    OWNER = await accounts(0);
    USER1 = await accounts(1);
    NOTHING = await accounts(3);

    contractsRegistry = await ContractsRegistry.new();
    const _tokenFactory = await TokenFactory.new();
    const _tokenRegistry = await TokenRegistry.new();
    const _roleManager = await RoleManager.new();
    const _marketplace = await Marketplace.new();

    await contractsRegistry.__OwnableContractsRegistry_init();

    await contractsRegistry.addProxyContract(await contractsRegistry.TOKEN_FACTORY_NAME(), _tokenFactory.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.TOKEN_REGISTRY_NAME(), _tokenRegistry.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.MARKETPLACE_NAME(), _marketplace.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.ROLE_MANAGER_NAME(), _roleManager.address);

    const tokenRegistry = await TokenRegistry.at(await contractsRegistry.getTokenRegistryContract());
    const roleManager = await RoleManager.at(await contractsRegistry.getRoleManagerContract());
    marketplace = await Marketplace.at(await contractsRegistry.getMarketplaceContract());

    await roleManager.__RoleManager_init();

    await contractsRegistry.injectDependencies(await contractsRegistry.TOKEN_FACTORY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.TOKEN_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.MARKETPLACE_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.ROLE_MANAGER_NAME());

    const tokenName = [await _tokenRegistry.TOKEN_POOL()];
    const tokenAddr = [(await ERC721MintableToken.new()).address];
    await tokenRegistry.setNewImplementations(tokenName, tokenAddr);

    await marketplace.__Marketplace_init(defaultBaseURI);

    paymentToken = await deployERC20("TestERC20", "TERC20", [OWNER, USER1]);

    nft = await ERC721Mock.new("Test NFT", "TNFT");

    defaultVoucherContract = await deployERC20("Test Voucher Token", "TVT", [OWNER, USER1]);

    defaultEndTime = toBN(await getCurrentBlockTime()).plus(signDuration);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("creation", () => {
    it("should set correct data after deployment", async () => {});

    it("should get exception if contract already initialized", async () => {
      await truffleAssert.reverts(
        marketplace.__Marketplace_init(defaultBaseURI),
        "Initializable: contract is already initialized"
      );
    });
  });

  describe("dependency injection", () => {
    it("should not allow random users to inject dependencies", async () => {
      await truffleAssert.reverts(
        marketplace.setDependencies(contractsRegistry.address, "0x"),
        "Dependant: not an injector"
      );
    });
  });

  describe("addToken()", () => {
    const name = "Test";
    const symbol = "TST";
    const pricePerOneToken = wei(100);
    const minNFTFloorPrice = wei(100, priceDecimals);
    const voucherTokensAmount = wei(0);
    const isNFTBuyable = false;
    const voucherTokenContract = ZERO_ADDR;
    const fundsRecipient = ZERO_ADDR;

    it("should add token correctly", async () => {
      const tx = await marketplace.addToken(name, symbol, [
        pricePerOneToken,
        minNFTFloorPrice,
        voucherTokensAmount,
        voucherTokenContract,
        fundsRecipient,
        isNFTBuyable,
        false,
      ]);

      assert.equal(tx.logs[0].event, "TokenContractDeployed");
      assert.equal(tx.logs[0].args.tokenName, name);
      assert.equal(tx.logs[0].args.tokenSymbol, symbol);
      assert.equal(tx.logs[0].args.tokenParams.pricePerOneToken, pricePerOneToken);
      assert.equal(tx.logs[0].args.tokenParams.minNFTFloorPrice, minNFTFloorPrice);
      assert.equal(tx.logs[0].args.tokenParams.voucherTokensAmount, voucherTokensAmount);
      assert.equal(tx.logs[0].args.tokenParams.isNFTBuyable, isNFTBuyable);
      assert.equal(tx.logs[0].args.tokenParams.voucherTokenContract, voucherTokenContract);
      assert.equal(tx.logs[0].args.tokenParams.fundsRecipient, fundsRecipient);
      assert.equal(tx.logs[0].args.tokenParams.isDisabled, false);

      const token = await ERC721MintableToken.at(tx.logs[0].args.tokenContract);
      assert.equal(await token.name(), name);
      assert.equal(await token.symbol(), symbol);
    });

    it("should revert if caller is not a marketplace manager", async () => {
      await truffleAssert.reverts(
        marketplace.addToken(
          name,
          symbol,
          [
            pricePerOneToken,
            minNFTFloorPrice,
            voucherTokensAmount,
            voucherTokenContract,
            fundsRecipient,
            isNFTBuyable,
            false,
          ],
          { from: NOTHING }
        ),
        "Marketplace: Caller is not a marketplace manager."
      );
    });

    it("should return if name is empty", async () => {
      await truffleAssert.reverts(
        marketplace.addToken("", symbol, [
          pricePerOneToken,
          minNFTFloorPrice,
          voucherTokensAmount,
          voucherTokenContract,
          fundsRecipient,
          isNFTBuyable,
          false,
        ]),
        "Marketplace: Token name or symbol is empty."
      );
    });

    it("should return if symbol is empty", async () => {
      await truffleAssert.reverts(
        marketplace.addToken(name, "", [
          pricePerOneToken,
          minNFTFloorPrice,
          voucherTokensAmount,
          voucherTokenContract,
          fundsRecipient,
          isNFTBuyable,
          false,
        ]),
        "Marketplace: Token name or symbol is empty."
      );
    });

    it("should return if isDisabled is true", async () => {
      await truffleAssert.reverts(
        marketplace.addToken(name, symbol, [
          pricePerOneToken,
          minNFTFloorPrice,
          voucherTokensAmount,
          voucherTokenContract,
          fundsRecipient,
          isNFTBuyable,
          true,
        ]),
        "Marketplace: Token can not be disabled on creation."
      );
    });
  });

  describe("updateAllParams", () => {
    const newPricePerOneToken = wei(75);
    const newMinNFTFloorPrice = wei(60, priceDecimals);
    const newVoucherTokensAmount = wei(0);
    const newIsNFTBuyable = true;
    const newVoucherTokenContract = ZERO_ADDR;
    const newFundsRecipient = ZERO_ADDR;
    const newName = "new name";
    const newSymbol = "NS";

    let tokenContract;

    beforeEach("setup", async () => {
      tokenContract = await marketplace.addToken.call("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        false,
        false,
      ]);
      await marketplace.addToken("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        false,
        false,
      ]);
    });

    it("should correctly update all params", async () => {
      const tx = await marketplace.updateAllParams(tokenContract, newName, newSymbol, [
        newPricePerOneToken,
        newMinNFTFloorPrice,
        newVoucherTokensAmount,
        newVoucherTokenContract,
        newFundsRecipient,
        newIsNFTBuyable,
        true,
      ]);

      const tokenParams = (await marketplace.getDetailedTokenParams([tokenContract]))[0];
      assert.equal(tokenParams.tokenParams.pricePerOneToken, newPricePerOneToken);
      assert.equal(tokenParams.tokenParams.minNFTFloorPrice, newMinNFTFloorPrice);
      assert.equal(tokenParams.tokenParams.voucherTokensAmount, newVoucherTokensAmount);
      assert.equal(tokenParams.tokenParams.isNFTBuyable, newIsNFTBuyable);
      assert.equal(tokenParams.tokenParams.voucherTokenContract, newVoucherTokenContract);
      assert.equal(tokenParams.tokenParams.fundsRecipient, newFundsRecipient);
      assert.equal(tokenParams.tokenParams.isDisabled, true);

      assert.equal(tx.receipt.logs[0].event, "TokenContractParamsUpdated");
      assert.equal(tx.receipt.logs[0].args.tokenContract, tokenContract);
      assert.equal(tx.receipt.logs[0].args.tokenName, newName);
      assert.equal(tx.receipt.logs[0].args.tokenSymbol, newSymbol);

      const newTokenParams = tx.receipt.logs[0].args.tokenParams;
      assert.equal(newTokenParams.pricePerOneToken, newPricePerOneToken);
      assert.equal(newTokenParams.minNFTFloorPrice, newMinNFTFloorPrice);
      assert.equal(newTokenParams.voucherTokensAmount, newVoucherTokensAmount);
      assert.equal(newTokenParams.isNFTBuyable, newIsNFTBuyable);
      assert.equal(newTokenParams.voucherTokenContract, newVoucherTokenContract);
      assert.equal(newTokenParams.fundsRecipient, newFundsRecipient);
      assert.equal(newTokenParams.isDisabled, true);
    });

    it("should revert if caller is not a Marketplace manager", async () => {
      await truffleAssert.reverts(
        marketplace.updateAllParams(
          tokenContract,
          newName,
          newSymbol,
          [
            newPricePerOneToken,
            newMinNFTFloorPrice,
            newVoucherTokensAmount,
            newVoucherTokenContract,
            newFundsRecipient,
            newIsNFTBuyable,
            false,
          ],
          { from: NOTHING }
        ),
        "Marketplace: Caller is not a marketplace manager."
      );
    });

    it("should revert if contract not exists", async () => {
      await truffleAssert.reverts(
        marketplace.updateAllParams(ZERO_ADDR, newName, newSymbol, [
          newPricePerOneToken,
          newMinNFTFloorPrice,
          newVoucherTokensAmount,
          newVoucherTokenContract,
          newFundsRecipient,
          newIsNFTBuyable,
          false,
        ]),
        "Marketplace: Token contract not found."
      );
    });

    it("should return if name is empty", async () => {
      await truffleAssert.reverts(
        marketplace.updateAllParams(tokenContract, "", newSymbol, [
          newPricePerOneToken,
          newMinNFTFloorPrice,
          newVoucherTokensAmount,
          newVoucherTokenContract,
          newFundsRecipient,
          newIsNFTBuyable,
          false,
        ]),
        "Marketplace: Token name or symbol is empty."
      );
    });

    it("should return if symbol is empty", async () => {
      await truffleAssert.reverts(
        marketplace.updateAllParams(tokenContract, newName, "", [
          newPricePerOneToken,
          newMinNFTFloorPrice,
          newVoucherTokensAmount,
          newVoucherTokenContract,
          newFundsRecipient,
          newIsNFTBuyable,
          false,
        ]),
        "Marketplace: Token name or symbol is empty."
      );
    });
  });

  describe("pause/unpause", () => {
    const tokenId = 0;
    const nftFloorPrice = wei(90, priceDecimals);
    let tokenContract;

    beforeEach("setup", async () => {
      await nft.mint(USER1, tokenId);
      await nft.approve(marketplace.address, tokenId, { from: USER1 });

      tokenContract = await marketplace.addToken.call("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        true,
        false,
      ]);
      await marketplace.addToken("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        true,
        false,
      ]);
    });

    it("should pause and unpause token creating", async () => {
      const reason = "Pausable: paused";

      await marketplace.pause();

      await truffleAssert.reverts(
        marketplace.addToken("Test", "TST", [
          defaultPricePerOneToken,
          defaultMinNFTFloorPrice,
          defaultVoucherTokensAmount,
          defaultVoucherContract.address,
          ZERO_ADDR,
          true,
          false,
        ]),
        reason
      );

      await marketplace.unpause();

      await marketplace.addToken("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        true,
        false,
      ]);
    });

    it("should pause and unpause token updating", async () => {
      const reason = "Pausable: paused";

      await marketplace.pause();

      await truffleAssert.reverts(
        marketplace.updateAllParams(tokenContract, "Test", "TST", [
          defaultPricePerOneToken,
          defaultMinNFTFloorPrice,
          defaultVoucherTokensAmount,
          defaultVoucherContract.address,
          ZERO_ADDR,
          true,
          false,
        ]),
        reason
      );

      await marketplace.unpause();

      await marketplace.updateAllParams(tokenContract, "Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        true,
        false,
      ]);
    });

    it("should pause and unpause base token uri", async () => {
      const reason = "Pausable: paused";

      await marketplace.pause();

      await truffleAssert.reverts(marketplace.setBaseTokenContractsURI("base token URI"), reason);

      await marketplace.unpause();

      await marketplace.setBaseTokenContractsURI("base token URI");
    });

    it("should pause and unpause token minting", async () => {
      const reason = "Pausable: paused";

      await marketplace.pause();

      const sig = signBuyTest({ tokenContract: tokenContract });

      await truffleAssert.reverts(
        marketplace.buyTokenWithERC20(
          [
            [paymentToken.address, tokenPrice, defaultDiscountValue, 0],
            tokenContract,
            0,
            defaultEndTime,
            defaultTokenURI,
          ],
          [sig.r, sig.s, sig.v],
          {
            from: USER1,
          }
        ),
        reason
      );

      const newTokenURI = "new token URI";
      const sigNft = signBuyTest({
        tokenContract: tokenContract,
        futureTokenId: 1,
        paymentTokenAddress: nft.address,
        paymentTokenPrice: nftFloorPrice.toFixed(),
        tokenURI: newTokenURI,
      });

      await truffleAssert.reverts(
        marketplace.buyTokenWithNFT(
          [[nft.address, nftFloorPrice, defaultDiscountValue, tokenId], tokenContract, 0, defaultEndTime, newTokenURI],
          [sigNft.r, sigNft.s, sigNft.v],
          { from: USER1 }
        ),
        reason
      );

      await marketplace.unpause();

      await marketplace.buyTokenWithERC20(
        [
          [paymentToken.address, tokenPrice, defaultDiscountValue, 0],
          tokenContract,
          0,
          defaultEndTime,
          defaultTokenURI,
        ],
        [sig.r, sig.s, sig.v],
        {
          from: USER1,
        }
      );

      await marketplace.buyTokenWithNFT(
        [[nft.address, nftFloorPrice, defaultDiscountValue, tokenId], tokenContract, 1, defaultEndTime, newTokenURI],
        [sigNft.r, sigNft.s, sigNft.v],
        { from: USER1 }
      );

      const token = await ERC721MintableToken.at(tokenContract);

      assert.equal(await token.tokenURI(0), defaultBaseURI + defaultTokenURI);
      assert.equal(await token.tokenURI(1), defaultBaseURI + newTokenURI);

      assert.equal(await token.ownerOf(0), USER1);
      assert.equal(await token.ownerOf(1), USER1);
    });

    it("should get exception if non admin try to call this function", async () => {
      const reason = "Marketplace: Caller is not a marketplace manager.";

      await truffleAssert.reverts(marketplace.pause({ from: USER1 }), reason);
      await truffleAssert.reverts(marketplace.unpause({ from: USER1 }), reason);
    });
  });

  describe("withdrawCurrency()", () => {
    const tokenId = 13;
    let tokenContract;

    beforeEach("setup", async () => {
      await nft.mint(USER1, tokenId);
      await nft.approve(marketplace.address, tokenId, { from: USER1 });

      await marketplace.addToken("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        true,
        false,
      ]);

      tokenContract = await ERC721MintableToken.at((await marketplace.getTokenContractsPart(0, 10))[0]);
    });

    it("should withdraw ERC20 tokens", async () => {
      const newDecimals = 8;

      await paymentToken.setDecimals(newDecimals);

      const sig = signBuyTest({ tokenContract: tokenContract.address });

      const expectedPaymentAmount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);
      const expectedTokensAmount = expectedPaymentAmount.idiv(wei(1, 10));

      await marketplace.buyTokenWithERC20(
        [
          [paymentToken.address, tokenPrice, defaultDiscountValue, 0],
          tokenContract.address,
          0,
          defaultEndTime,
          defaultTokenURI,
        ],
        [sig.r, sig.s, sig.v],
        {
          from: USER1,
        }
      );

      assert.equal((await paymentToken.balanceOf(marketplace.address)).toFixed(), expectedTokensAmount.toFixed());

      const tx = await marketplace.withdrawCurrency(paymentToken.address, OWNER, 0, true);

      assert.equal(
        toBN(await paymentToken.balanceOf(OWNER)).toFixed(),
        mintTokensAmount.plus(expectedTokensAmount).toFixed()
      );

      assert.equal(tx.receipt.logs[0].event, "PaidTokensWithdrawn");
      assert.equal(tx.receipt.logs[0].args.tokenAddr, paymentToken.address);
      assert.equal(tx.receipt.logs[0].args.recipient, OWNER);
      assert.equal(toBN(tx.receipt.logs[0].args.amount).toFixed(), expectedPaymentAmount.toFixed());
    });

    it("should withdraw ERC20 tokens partially", async () => {
      const newDecimals = 8;

      await paymentToken.setDecimals(newDecimals);

      const sig = signBuyTest({ tokenContract: tokenContract.address });

      const expectedPaymentAmount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);
      const expectedTokensAmount = expectedPaymentAmount.idiv(wei(1, 10));

      const desiredWithdrawalAmount = expectedTokensAmount.idiv(2);

      await marketplace.buyTokenWithERC20(
        [
          [paymentToken.address, tokenPrice, defaultDiscountValue, 0],
          tokenContract.address,
          0,
          defaultEndTime,
          defaultTokenURI,
        ],
        [sig.r, sig.s, sig.v],
        {
          from: USER1,
        }
      );

      assert.equal((await paymentToken.balanceOf(marketplace.address)).toFixed(), expectedTokensAmount.toFixed());

      const tx = await marketplace.withdrawCurrency(paymentToken.address, OWNER, desiredWithdrawalAmount, false);

      assert.equal(
        toBN(await paymentToken.balanceOf(OWNER)).toFixed(),
        mintTokensAmount.plus(desiredWithdrawalAmount).toFixed()
      );

      assert.equal(tx.receipt.logs[0].event, "PaidTokensWithdrawn");
      assert.equal(tx.receipt.logs[0].args.tokenAddr, paymentToken.address);
      assert.equal(tx.receipt.logs[0].args.recipient, OWNER);
      assert.equal(toBN(tx.receipt.logs[0].args.amount).toFixed(), expectedPaymentAmount.idiv(2).toFixed());

      const tx2 = await marketplace.withdrawCurrency(paymentToken.address, OWNER, expectedTokensAmount, false);

      assert.equal(
        toBN(await paymentToken.balanceOf(OWNER)).toFixed(),
        mintTokensAmount.plus(expectedTokensAmount).toFixed()
      );

      assert.equal(tx2.receipt.logs[0].event, "PaidTokensWithdrawn");
      assert.equal(tx2.receipt.logs[0].args.tokenAddr, paymentToken.address);
      assert.equal(tx2.receipt.logs[0].args.recipient, OWNER);
      assert.equal(toBN(tx2.receipt.logs[0].args.amount).toFixed(), expectedPaymentAmount.idiv(2).toFixed());
    });

    it("should get exception if nothing to withdraw", async () => {
      const reason = "Marketplace: Nothing to withdraw.";

      await truffleAssert.reverts(marketplace.withdrawCurrency(paymentToken.address, USER1, 0, true), reason);
      await truffleAssert.reverts(marketplace.withdrawCurrency(paymentToken.address, USER1, 1, true), reason);
      await truffleAssert.reverts(marketplace.withdrawCurrency(paymentToken.address, USER1, 0, false), reason);
      await truffleAssert.reverts(marketplace.withdrawCurrency(paymentToken.address, USER1, 1, false), reason);
    });

    it("should get exception if no a withdrawal manager calls this function", async () => {
      const reason = "Marketplace: Caller is not a withdrawal manager.";

      await truffleAssert.reverts(marketplace.withdrawCurrency(ZERO_ADDR, USER1, 0, true, { from: USER1 }), reason);
    });

    it("should correctly withdraw native currency", async () => {
      const sig = signBuyTest({
        tokenContract: tokenContract.address,
        paymentTokenAddress: ZERO_ADDR,
      });

      const expectedCurrencyAmount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);

      await marketplace.buyTokenWithETH(
        [[ZERO_ADDR, tokenPrice, defaultDiscountValue, 0], tokenContract.address, 0, defaultEndTime, defaultTokenURI],
        [sig.r, sig.s, sig.v],
        {
          from: USER1,
          value: expectedCurrencyAmount,
        }
      );

      assert.equal(toBN(await web3.eth.getBalance(marketplace.address)).toFixed(), expectedCurrencyAmount.toFixed());

      const currencyBalanceBefore = toBN(await web3.eth.getBalance(USER1));

      const tx = await marketplace.withdrawCurrency(ZERO_ADDR, USER1, 1, true);

      const currencyBalanceAfter = toBN(await web3.eth.getBalance(USER1));

      assert.equal(currencyBalanceAfter.minus(currencyBalanceBefore).toFixed(), expectedCurrencyAmount.toFixed());

      assert.equal(tx.receipt.logs[0].event, "PaidTokensWithdrawn");
      assert.equal(tx.receipt.logs[0].args.tokenAddr, ZERO_ADDR);
      assert.equal(tx.receipt.logs[0].args.recipient, USER1);
      assert.equal(toBN(tx.receipt.logs[0].args.amount).toFixed(), expectedCurrencyAmount.toFixed());
    });

    it("should correctly withdraw native currency partially", async () => {
      const sig = signBuyTest({
        tokenContract: tokenContract.address,
        paymentTokenAddress: ZERO_ADDR,
      });

      const expectedCurrencyAmount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);

      await marketplace.buyTokenWithETH(
        [[ZERO_ADDR, tokenPrice, defaultDiscountValue, 0], tokenContract.address, 0, defaultEndTime, defaultTokenURI],
        [sig.r, sig.s, sig.v],
        {
          from: USER1,
          value: expectedCurrencyAmount,
        }
      );

      const desiredWithdrawalAmount = expectedCurrencyAmount.div(2);
      assert.equal(toBN(await web3.eth.getBalance(marketplace.address)).toFixed(), expectedCurrencyAmount.toFixed());

      const currencyBalanceBefore = toBN(await web3.eth.getBalance(USER1));

      const tx = await marketplace.withdrawCurrency(ZERO_ADDR, USER1, desiredWithdrawalAmount, false);

      const currencyBalanceAfter = toBN(await web3.eth.getBalance(USER1));

      assert.equal(currencyBalanceAfter.minus(currencyBalanceBefore).toFixed(), desiredWithdrawalAmount.toFixed());

      assert.equal(tx.receipt.logs[0].event, "PaidTokensWithdrawn");
      assert.equal(tx.receipt.logs[0].args.tokenAddr, ZERO_ADDR);
      assert.equal(tx.receipt.logs[0].args.recipient, USER1);
      assert.equal(toBN(tx.receipt.logs[0].args.amount).toFixed(), desiredWithdrawalAmount.toFixed());

      const currencyBalanceBefore2 = toBN(await web3.eth.getBalance(USER1));

      const tx2 = await marketplace.withdrawCurrency(ZERO_ADDR, USER1, expectedCurrencyAmount, false);

      const currencyBalanceAfter2 = toBN(await web3.eth.getBalance(USER1));

      assert.equal(currencyBalanceAfter2.minus(currencyBalanceBefore2).toFixed(), desiredWithdrawalAmount.toFixed());

      assert.equal(tx2.receipt.logs[0].event, "PaidTokensWithdrawn");
      assert.equal(tx2.receipt.logs[0].args.tokenAddr, ZERO_ADDR);
      assert.equal(tx2.receipt.logs[0].args.recipient, USER1);
      assert.equal(toBN(tx2.receipt.logs[0].args.amount).toFixed(), desiredWithdrawalAmount.toFixed());
    });

    it("should get exception if failed to transfer native currency to the recipient", async () => {
      const reason = "Marketplace: Failed to send currency to the recipient.";

      const sig = signBuyTest({
        tokenContract: tokenContract.address,
        paymentTokenAddress: ZERO_ADDR,
      });

      const expectedCurrencyAmount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);

      await marketplace.buyTokenWithETH(
        [[ZERO_ADDR, tokenPrice, defaultDiscountValue, 0], tokenContract.address, 0, defaultEndTime, defaultTokenURI],
        [sig.r, sig.s, sig.v],
        {
          from: USER1,
          value: expectedCurrencyAmount,
        }
      );

      await truffleAssert.reverts(marketplace.withdrawCurrency(ZERO_ADDR, marketplace.address, 0, true), reason);
    });
  });

  describe("buyTokenWithETH", () => {
    let tokenContract;

    beforeEach("setup", async () => {
      await marketplace.addToken("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        true,
        false,
      ]);

      tokenContract = await ERC721MintableToken.at((await marketplace.getTokenContractsPart(0, 10))[0]);
    });

    it("should correctly buy token with ETH", async () => {
      const sig = signBuyTest({ tokenContract: tokenContract.address, paymentTokenAddress: ZERO_ADDR });

      const extraAmount = wei(0.1);
      const expectedValueAmount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);

      const balanceBefore = toBN(await web3.eth.getBalance(USER1));

      const tx = await marketplace.buyTokenWithETH(
        [[ZERO_ADDR, tokenPrice, defaultDiscountValue, 0], tokenContract.address, 0, defaultEndTime, defaultTokenURI],
        [sig.r, sig.s, sig.v],
        {
          from: USER1,
          value: expectedValueAmount.plus(extraAmount),
        }
      );

      const balanceAfter = await web3.eth.getBalance(USER1);

      assert.equal(await tokenContract.ownerOf(0), USER1);
      assert.closeTo(
        balanceBefore.minus(balanceAfter).toNumber(),
        expectedValueAmount.toNumber(),
        wei(0.001).toNumber()
      );

      const log = tx.receipt.logs[0];

      assert.equal(log.event, "TokenSuccessfullyPurchased");

      assert.equal(log.args.recipient, USER1);
      assert.equal(toBN(log.args.mintedTokenPrice).toFixed(), defaultPricePerOneToken.toFixed());
      assert.equal(toBN(log.args.paidTokensAmount).toFixed(), expectedValueAmount.toFixed());
      assert.equal(toBN(log.args.paymentType).toFixed(), PaymentType.NATIVE);

      assert.equal(log.args.buyParams.paymentDetails.paymentTokenAddress, ZERO_ADDR);
      assert.equal(toBN(log.args.buyParams.paymentDetails.paymentTokenPrice).toFixed(), tokenPrice.toFixed());
      assert.equal(toBN(log.args.buyParams.paymentDetails.discount).toFixed(), defaultDiscountValue.toFixed());
      assert.equal(toBN(log.args.buyParams.paymentDetails.nftTokenId).toFixed(), 0);

      assert.equal(log.args.buyParams.tokenContract, tokenContract.address);
      assert.equal(toBN(log.args.buyParams.futureTokenId).toFixed(), 0);
      assert.equal(toBN(log.args.buyParams.endTimestamp).toFixed(), defaultEndTime.toFixed());
      assert.equal(log.args.buyParams.tokenURI, defaultTokenURI);
    });

    it("should correctly buy token with ETH and send currency to the funds recipient", async () => {
      await marketplace.updateAllParams(tokenContract.address, "Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        OWNER,
        true,
        false,
      ]);

      const sig = signBuyTest({ tokenContract: tokenContract.address, paymentTokenAddress: ZERO_ADDR });

      const expectedValueAmount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);
      const balanceBefore = await web3.eth.getBalance(OWNER);

      await marketplace.buyTokenWithETH(
        [[ZERO_ADDR, tokenPrice, defaultDiscountValue, 0], tokenContract.address, 0, defaultEndTime, defaultTokenURI],
        [sig.r, sig.s, sig.v],
        {
          from: USER1,
          value: expectedValueAmount,
        }
      );

      const balanceAfter = toBN(await web3.eth.getBalance(OWNER));

      assert.equal(balanceAfter.minus(balanceBefore).toFixed(), expectedValueAmount.toFixed());
    });

    it("should get exception if token contract does not exist", async () => {
      const reason = "Marketplace: Token contract not found.";

      const sig = signBuyTest({ tokenContract: ZERO_ADDR, paymentTokenAddress: ZERO_ADDR, paymentTokenPrice: "0" });

      await truffleAssert.reverts(
        marketplace.buyTokenWithETH(
          [[ZERO_ADDR, 0, defaultDiscountValue, 0], ZERO_ADDR, 0, defaultEndTime, defaultTokenURI],
          [sig.r, sig.s, sig.v],
          {
            from: USER1,
          }
        ),
        reason
      );
    });

    it("should get exception if token contract disabled", async () => {
      const reason = "Marketplace: Unable to buy disabled token";

      await marketplace.updateAllParams(tokenContract.address, "Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        true,
        true,
      ]);

      const sig = signBuyTest({
        tokenContract: tokenContract.address,
        paymentTokenAddress: ZERO_ADDR,
        paymentTokenPrice: "0",
      });

      await truffleAssert.reverts(
        marketplace.buyTokenWithETH(
          [
            [tokenContract.address, 0, defaultDiscountValue, 0],
            tokenContract.address,
            0,
            defaultEndTime,
            defaultTokenURI,
          ],
          [sig.r, sig.s, sig.v],
          {
            from: USER1,
          }
        ),
        reason
      );
    });

    it("should get exception if sign data with wrong private key", async () => {
      const reason = "Marketplace: Invalid signature.";

      const sig = signBuyTest({
        tokenContract: tokenContract.address,
        paymentTokenAddress: ZERO_ADDR,
        paymentTokenPrice: "0",
        privateKey: USER1_PK,
      });

      await truffleAssert.reverts(
        marketplace.buyTokenWithETH(
          [
            [tokenContract.address, 0, defaultDiscountValue, 0],
            tokenContract.address,
            0,
            defaultEndTime,
            defaultTokenURI,
          ],
          [sig.r, sig.s, sig.v],
          {
            from: USER1,
          }
        ),
        reason
      );
    });

    it("should get exception if signature expired", async () => {
      const reason = "Marketplace: Signature expired.";

      const sig = signBuyTest({
        tokenContract: tokenContract.address,
        paymentTokenAddress: ZERO_ADDR,
        paymentTokenPrice: "0",
      });

      await setNextBlockTime(defaultEndTime.plus(100).toNumber());

      await truffleAssert.reverts(
        marketplace.buyTokenWithETH(
          [[ZERO_ADDR, 0, defaultDiscountValue, 0], tokenContract.address, 0, defaultEndTime, defaultTokenURI],
          [sig.r, sig.s, sig.v],
          {
            from: USER1,
          }
        ),
        reason
      );
    });

    it("should get exception if pass invalid payment token", async () => {
      const reason = "Marketplace: Invalid payment token address";

      const sig = signBuyTest({
        tokenContract: tokenContract.address,
        paymentTokenAddress: paymentToken.address,
        paymentTokenPrice: "0",
      });

      await truffleAssert.reverts(
        marketplace.buyTokenWithETH(
          [
            [paymentToken.address, 0, defaultDiscountValue, 0],
            tokenContract.address,
            0,
            defaultEndTime,
            defaultTokenURI,
          ],
          [sig.r, sig.s, sig.v],
          {
            from: USER1,
          }
        ),
        reason
      );
    });

    it("should get exception if send currency value less than needed", async () => {
      const reason = "Marketplace: Invalid currency amount.";

      const sig = signBuyTest({ tokenContract: tokenContract.address, paymentTokenAddress: ZERO_ADDR });

      const expectedValueAmount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);

      await truffleAssert.reverts(
        marketplace.buyTokenWithETH(
          [[ZERO_ADDR, tokenPrice, defaultDiscountValue, 0], tokenContract.address, 0, defaultEndTime, defaultTokenURI],
          [sig.r, sig.s, sig.v],
          {
            from: USER1,
            value: expectedValueAmount.idiv(2),
          }
        ),
        reason
      );
    });
  });

  describe("buyTokenWithERC20", () => {
    let tokenContract;

    beforeEach("setup", async () => {
      await marketplace.addToken("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        true,
        false,
      ]);

      tokenContract = await ERC721MintableToken.at((await marketplace.getTokenContractsPart(0, 10))[0]);
    });

    it("should correctly buy token with ERC20", async () => {
      const sig = signBuyTest({ tokenContract: tokenContract.address });

      const expectedTokensAmount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);

      const tx = await marketplace.buyTokenWithERC20(
        [
          [paymentToken.address, tokenPrice, defaultDiscountValue, 0],
          tokenContract.address,
          0,
          defaultEndTime,
          defaultTokenURI,
        ],
        [sig.r, sig.s, sig.v],
        {
          from: USER1,
        }
      );

      assert.equal(await tokenContract.ownerOf(0), USER1);
      assert.equal(
        (await paymentToken.balanceOf(USER1)).toFixed(),
        mintTokensAmount.minus(expectedTokensAmount).toFixed()
      );

      const log = tx.receipt.logs[0];

      assert.equal(log.event, "TokenSuccessfullyPurchased");

      assert.equal(log.args.recipient, USER1);
      assert.equal(toBN(log.args.mintedTokenPrice).toFixed(), defaultPricePerOneToken.toFixed());
      assert.equal(toBN(log.args.paidTokensAmount).toFixed(), expectedTokensAmount.toFixed());
      assert.equal(toBN(log.args.paymentType).toFixed(), PaymentType.ERC20);

      assert.equal(log.args.buyParams.paymentDetails.paymentTokenAddress, paymentToken.address);
      assert.equal(toBN(log.args.buyParams.paymentDetails.paymentTokenPrice).toFixed(), tokenPrice.toFixed());
      assert.equal(toBN(log.args.buyParams.paymentDetails.discount).toFixed(), defaultDiscountValue.toFixed());
      assert.equal(toBN(log.args.buyParams.paymentDetails.nftTokenId).toFixed(), 0);

      assert.equal(log.args.buyParams.tokenContract, tokenContract.address);
      assert.equal(toBN(log.args.buyParams.futureTokenId).toFixed(), 0);
      assert.equal(toBN(log.args.buyParams.endTimestamp).toFixed(), defaultEndTime.toFixed());
      assert.equal(log.args.buyParams.tokenURI, defaultTokenURI);
    });

    it("should correctly buy token with discount", async () => {
      const discount = PRECISION.times(15);

      const sig = signBuyTest({ tokenContract: tokenContract.address, discount: discount.toFixed() });

      const expectedTokensAmount = defaultPricePerOneToken
        .times(wei(1))
        .idiv(tokenPrice)
        .times(PERCENTAGE_100.minus(discount))
        .idiv(PERCENTAGE_100);

      const tx = await marketplace.buyTokenWithERC20(
        [[paymentToken.address, tokenPrice, discount, 0], tokenContract.address, 0, defaultEndTime, defaultTokenURI],
        [sig.r, sig.s, sig.v],
        {
          from: USER1,
        }
      );

      assert.equal(await tokenContract.ownerOf(0), USER1);
      assert.equal(
        (await paymentToken.balanceOf(USER1)).toFixed(),
        mintTokensAmount.minus(expectedTokensAmount).toFixed()
      );

      const log = tx.receipt.logs[0];

      assert.equal(log.event, "TokenSuccessfullyPurchased");

      assert.equal(log.args.recipient, USER1);
      assert.equal(toBN(log.args.paidTokensAmount).toFixed(), expectedTokensAmount.toFixed());
      assert.equal(toBN(log.args.paymentType).toFixed(), PaymentType.ERC20);
    });
  });

  describe("buyTokenWithVoucher", () => {
    let tokenContract;

    beforeEach("setup", async () => {
      await marketplace.addToken("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        true,
        false,
      ]);

      tokenContract = await ERC721MintableToken.at((await marketplace.getTokenContractsPart(0, 10))[0]);
    });

    it("should correctly buy token with voucher", async () => {
      const sig = signBuyTest({
        tokenContract: tokenContract.address,
        paymentTokenAddress: defaultVoucherContract.address,
        paymentTokenPrice: "0",
      });

      const tx = await marketplace.buyTokenWithVoucher(
        [
          [defaultVoucherContract.address, 0, defaultDiscountValue, 0],
          tokenContract.address,
          0,
          defaultEndTime,
          defaultTokenURI,
        ],
        [sig.r, sig.s, sig.v],
        {
          from: USER1,
        }
      );

      assert.equal(await tokenContract.ownerOf(0), USER1);
      assert.equal(
        (await defaultVoucherContract.balanceOf(USER1)).toFixed(),
        mintTokensAmount.minus(defaultVoucherTokensAmount).toFixed()
      );

      const log = tx.receipt.logs[0];

      assert.equal(log.event, "TokenSuccessfullyPurchased");

      assert.equal(log.args.recipient, USER1);
      assert.equal(toBN(log.args.mintedTokenPrice).toFixed(), defaultPricePerOneToken.toFixed());
      assert.equal(toBN(log.args.paidTokensAmount).toFixed(), defaultVoucherTokensAmount.toFixed());
      assert.equal(toBN(log.args.paymentType).toFixed(), PaymentType.VOUCHER);

      assert.equal(log.args.buyParams.paymentDetails.paymentTokenAddress, defaultVoucherContract.address);
      assert.equal(toBN(log.args.buyParams.paymentDetails.paymentTokenPrice).toFixed(), 0);
      assert.equal(toBN(log.args.buyParams.paymentDetails.discount).toFixed(), defaultDiscountValue.toFixed());
      assert.equal(toBN(log.args.buyParams.paymentDetails.nftTokenId).toFixed(), 0);

      assert.equal(log.args.buyParams.tokenContract, tokenContract.address);
      assert.equal(toBN(log.args.buyParams.futureTokenId).toFixed(), 0);
      assert.equal(toBN(log.args.buyParams.endTimestamp).toFixed(), defaultEndTime.toFixed());
      assert.equal(log.args.buyParams.tokenURI, defaultTokenURI);
    });

    it("should get exception if voucher token does not set", async () => {
      const reason = "Marketplace: Unable to buy token with voucher";

      await marketplace.updateAllParams(tokenContract.address, "Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        0,
        ZERO_ADDR,
        ZERO_ADDR,
        true,
        false,
      ]);

      const sig = signBuyTest({
        tokenContract: tokenContract.address,
        paymentTokenAddress: defaultVoucherContract.address,
      });

      await truffleAssert.reverts(
        marketplace.buyTokenWithVoucher(
          [
            [defaultVoucherContract.address, tokenPrice, defaultDiscountValue, 0],
            tokenContract.address,
            0,
            defaultEndTime,
            defaultTokenURI,
          ],
          [sig.r, sig.s, sig.v],
          {
            from: USER1,
          }
        ),
        reason
      );
    });

    it("should get exception if pass invalid address", async () => {
      const reason = "Marketplace: Invalid payment token address";

      const sig = signBuyTest({ tokenContract: tokenContract.address, paymentTokenAddress: tokenContract.address });

      await truffleAssert.reverts(
        marketplace.buyTokenWithVoucher(
          [
            [tokenContract.address, tokenPrice, defaultDiscountValue, 0],
            tokenContract.address,
            0,
            defaultEndTime,
            defaultTokenURI,
          ],
          [sig.r, sig.s, sig.v],
          {
            from: USER1,
          }
        ),
        reason
      );
    });
  });

  describe("buyTokenWithNFT", () => {
    const tokenId = 13;
    const nftFloorPrice = wei(90, priceDecimals);
    let tokenContract;

    beforeEach("setup", async () => {
      await nft.mint(USER1, tokenId);
      await nft.approve(marketplace.address, tokenId, { from: USER1 });

      await marketplace.addToken("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        true,
        false,
      ]);

      tokenContract = await ERC721MintableToken.at((await marketplace.getTokenContractsPart(0, 10))[0]);
    });

    it("should correctly buy token with NFT", async () => {
      const sig = signBuyTest({
        tokenContract: tokenContract.address,
        paymentTokenAddress: nft.address,
        paymentTokenPrice: nftFloorPrice.toFixed(),
      });

      const tx = await marketplace.buyTokenWithNFT(
        [
          [nft.address, nftFloorPrice, defaultDiscountValue, tokenId],
          tokenContract.address,
          0,
          defaultEndTime,
          defaultTokenURI,
        ],
        [sig.r, sig.s, sig.v],
        {
          from: USER1,
        }
      );

      assert.equal(await tokenContract.ownerOf(0), USER1);
      assert.equal(await nft.ownerOf(tokenId), marketplace.address);

      const log = tx.receipt.logs[0];

      assert.equal(log.event, "TokenSuccessfullyPurchased");

      assert.equal(log.args.recipient, USER1);
      assert.equal(toBN(log.args.mintedTokenPrice).toFixed(), defaultMinNFTFloorPrice.toFixed());
      assert.equal(toBN(log.args.paidTokensAmount).toFixed(), 1);
      assert.equal(toBN(log.args.paymentType).toFixed(), PaymentType.NFT);

      assert.equal(log.args.buyParams.paymentDetails.paymentTokenAddress, nft.address);
      assert.equal(toBN(log.args.buyParams.paymentDetails.paymentTokenPrice).toFixed(), nftFloorPrice.toFixed());
      assert.equal(toBN(log.args.buyParams.paymentDetails.discount).toFixed(), defaultDiscountValue.toFixed());
      assert.equal(toBN(log.args.buyParams.paymentDetails.nftTokenId).toFixed(), tokenId);

      assert.equal(log.args.buyParams.tokenContract, tokenContract.address);
      assert.equal(toBN(log.args.buyParams.futureTokenId).toFixed(), 0);
      assert.equal(toBN(log.args.buyParams.endTimestamp).toFixed(), defaultEndTime.toFixed());
      assert.equal(log.args.buyParams.tokenURI, defaultTokenURI);
    });

    it("should get exception if nft buy option is disabled", async () => {
      await marketplace.updateAllParams(tokenContract.address, "Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        false,
        false,
      ]);

      const reason = "Marketplace: Unable to buy token with NFT";

      const sig = signBuyTest({
        tokenContract: tokenContract.address,
        paymentTokenAddress: nft.address,
        paymentTokenPrice: nftFloorPrice.toFixed(),
      });

      await truffleAssert.reverts(
        marketplace.buyTokenWithNFT(
          [
            [nft.address, nftFloorPrice, defaultDiscountValue, tokenId],
            tokenContract.address,
            0,
            defaultEndTime,
            defaultTokenURI,
          ],
          [sig.r, sig.s, sig.v],
          {
            from: USER1,
          }
        ),
        reason
      );
    });

    it("should get exception if nft floor price less than the min floor price", async () => {
      const reason = "Marketplace: NFT floor price is less than the minimal.";

      const newNFTFloorPrice = wei(70, priceDecimals);

      const sig = signBuyTest({
        tokenContract: tokenContract.address,
        paymentTokenAddress: nft.address,
        paymentTokenPrice: newNFTFloorPrice.toFixed(),
      });

      await truffleAssert.reverts(
        marketplace.buyTokenWithNFT(
          [
            [nft.address, newNFTFloorPrice, defaultDiscountValue, tokenId],
            tokenContract.address,
            0,
            defaultEndTime,
            defaultTokenURI,
          ],
          [sig.r, sig.s, sig.v],
          {
            from: USER1,
          }
        ),
        reason
      );
    });

    it("should get exception if sender is not the owner of the nft token", async () => {
      const reason = "Marketplace: Sender is not the owner.";

      const sig = signBuyTest({
        tokenContract: tokenContract.address,
        paymentTokenAddress: nft.address,
        paymentTokenPrice: nftFloorPrice.toFixed(),
      });

      await truffleAssert.reverts(
        marketplace.buyTokenWithNFT(
          [
            [nft.address, nftFloorPrice, defaultDiscountValue, tokenId],
            tokenContract.address,
            0,
            defaultEndTime,
            defaultTokenURI,
          ],
          [sig.r, sig.s, sig.v],
          {
            from: OWNER,
          }
        ),
        reason
      );
    });
  });

  describe("setBaseTokenContractsURI", () => {
    it("should correctly update base token contracts URI", async () => {
      const newBaseTokenContractsURI = "new base URI/";

      const tx = await marketplace.setBaseTokenContractsURI(newBaseTokenContractsURI);

      assert.equal(await marketplace.baseTokenContractsURI(), newBaseTokenContractsURI);

      assert.equal(tx.receipt.logs[0].event, "BaseTokenContractsURIUpdated");
      assert.equal(tx.receipt.logs[0].args.newBaseTokenContractsURI, newBaseTokenContractsURI);
    });

    it("should get exception if not marketplace manager try to call this function", async () => {
      const reason = "Marketplace: Caller is not a marketplace manager.";

      await truffleAssert.reverts(marketplace.setBaseTokenContractsURI("", { from: NOTHING }), reason);
    });
  });

  describe("getTokenContractsPart", () => {
    it("should return correct token contracts arr", async () => {
      const addressesArr = [];

      for (let i = 0; i < 5; i++) {
        let addr = await marketplace.addToken.call("Test" + i, "TST" + i, [
          defaultPricePerOneToken,
          defaultMinNFTFloorPrice,
          defaultVoucherTokensAmount,
          defaultVoucherContract.address,
          ZERO_ADDR,
          false,
          false,
        ]);
        await marketplace.addToken("Test" + i, "TST" + i, [
          defaultPricePerOneToken,
          defaultMinNFTFloorPrice,
          defaultVoucherTokensAmount,
          defaultVoucherContract.address,
          ZERO_ADDR,
          false,
          false,
        ]);

        addressesArr.push(addr);
      }

      assert.equal((await marketplace.getTokenContractsCount()).toString(), 5);

      assert.deepEqual(await marketplace.getTokenContractsPart(0, 10), addressesArr);
      assert.deepEqual(await marketplace.getTokenContractsPart(0, 3), addressesArr.slice(0, 3));
      assert.deepEqual(await marketplace.getTokenContractsPart(3, 10), addressesArr.slice(3));
    });
  });

  describe("getBaseTokenParamsPart()", () => {
    it("should return correct token params", async () => {
      const baseTokenParams = [];

      for (let i = 0; i < 5; i++) {
        const tokenParam = [
          i.toString(),
          defaultMinNFTFloorPrice,
          defaultVoucherTokensAmount,
          defaultVoucherContract.address,
          ZERO_ADDR,
          false,
          false,
        ];
        const addr = await marketplace.addToken.call("Test" + i, "TST" + i, tokenParam);
        await marketplace.addToken("Test" + i, "TST" + i, tokenParam);
        baseTokenParams.push([addr, false, i.toString(), "Test" + i]);
      }

      assert.equal((await marketplace.getTokenContractsCount()).toString(), 5);

      assert.deepEqual(await marketplace.getBaseTokenParamsPart(0, 10), baseTokenParams);
      assert.deepEqual(await marketplace.getBaseTokenParamsPart(0, 3), baseTokenParams.slice(0, 3));
      assert.deepEqual(await marketplace.getBaseTokenParamsPart(3, 10), baseTokenParams.slice(3));
    });
  });

  describe("getDetailedTokenParamsPart()", () => {
    it("should return correct token params", async () => {
      const detailedTokenParams = [];

      for (let i = 0; i < 5; i++) {
        const addr = await marketplace.addToken.call("Test" + i, "TST" + i, [
          i,
          defaultMinNFTFloorPrice,
          defaultVoucherTokensAmount,
          defaultVoucherContract.address,
          ZERO_ADDR,
          false,
          false,
        ]);
        await marketplace.addToken("Test" + i, "TST" + i, [
          i,
          defaultMinNFTFloorPrice,
          defaultVoucherTokensAmount,
          defaultVoucherContract.address,
          ZERO_ADDR,
          false,
          false,
        ]);
        detailedTokenParams.push([
          addr,
          [
            i.toString(),
            defaultMinNFTFloorPrice.toString(),
            defaultVoucherTokensAmount.toString(),
            defaultVoucherContract.address,
            ZERO_ADDR,
            false,
            false,
          ],
          "Test" + i,
          "TST" + i,
        ]);
      }

      assert.equal((await marketplace.getTokenContractsCount()).toString(), 5);

      assert.deepEqual(await marketplace.getDetailedTokenParamsPart(0, 10), detailedTokenParams);
      assert.deepEqual(await marketplace.getDetailedTokenParamsPart(0, 3), detailedTokenParams.slice(0, 3));
      assert.deepEqual(await marketplace.getDetailedTokenParamsPart(3, 10), detailedTokenParams.slice(3));
    });
  });

  describe("getActiveTokenContractsCount", () => {
    it("should return correct active token contracts count", async () => {
      for (let i = 0; i < 5; i++) {
        let addr = await marketplace.addToken.call("Test" + i, "TST" + i, [
          defaultPricePerOneToken,
          defaultMinNFTFloorPrice,
          defaultVoucherTokensAmount,
          defaultVoucherContract.address,
          ZERO_ADDR,
          false,
          false,
        ]);
        await marketplace.addToken("Test" + i, "TST" + i, [
          defaultPricePerOneToken,
          defaultMinNFTFloorPrice,
          defaultVoucherTokensAmount,
          defaultVoucherContract.address,
          ZERO_ADDR,
          false,
          false,
        ]);

        assert.equal((await marketplace.getTokenContractsCount()).toString(), i + 1);
        assert.equal((await marketplace.getActiveTokenContractsCount()).toString(), 1);

        await marketplace.updateAllParams(addr, "Test" + i, "TST" + i, [
          defaultPricePerOneToken,
          defaultMinNFTFloorPrice,
          defaultVoucherTokensAmount,
          defaultVoucherContract.address,
          ZERO_ADDR,
          false,
          true,
        ]);

        assert.equal((await marketplace.getActiveTokenContractsCount()).toString(), 0);
      }
    });
  });

  describe("createNFTRequest()", () => {
    const tokenId = 13;
    let tokenContract;

    beforeEach("setup", async () => {
      await nft.mint(USER1, tokenId);
      await nft.approve(marketplace.address, tokenId, { from: USER1 });

      tokenContract = await marketplace.addToken.call("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        true,
        false,
      ]);
      await marketplace.addToken("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        true,
        false,
      ]);
    });

    it("should create NFT request", async () => {
      const tx = await marketplace.createNFTRequest(nft.address, tokenId, tokenContract, { from: USER1 });

      assert.equal(await nft.ownerOf(tokenId), marketplace.address);

      assert.equal(tx.logs.length, 1);
      assert.equal(tx.logs[0].event, "NFTRequestCreated");
      assert.equal(tx.logs[0].args.requestId.toString(), "0");
      assert.equal(tx.logs[0].args.requester, USER1);
      assert.equal(tx.logs[0].args.nftId, tokenId);
      assert.equal(tx.logs[0].args.tokenContract, tokenContract);
    });

    it("should revert if desired token is not exists", async () => {
      await truffleAssert.reverts(
        marketplace.createNFTRequest(nft.address, tokenId, ZERO_ADDR),
        "Marketplace: Token contract not found."
      );
    });

    it("should revert if desired token is disabled", async () => {
      await marketplace.updateAllParams(tokenContract, "Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        true,
        true,
      ]);

      await truffleAssert.reverts(
        marketplace.createNFTRequest(nft.address, tokenId, tokenContract),
        "Marketplace: Token is disabled."
      );
    });

    it("should revert if desired token is not allowed for NFT", async () => {
      await marketplace.updateAllParams(tokenContract, "Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        false,
        false,
      ]);

      await truffleAssert.reverts(
        marketplace.createNFTRequest(nft.address, tokenId, tokenContract),
        "Marketplace: This token cannot be purchased with NFT."
      );
    });

    it("should revert if sender is not owner of NFT", async () => {
      await truffleAssert.reverts(
        marketplace.createNFTRequest(nft.address, tokenId, tokenContract),
        "Marketplace: Sender is not the owner."
      );
    });
  });

  describe("cancelNFTRequest()", () => {
    const tokenId = 13;
    let tokenContract;
    let requestId;

    beforeEach("setup", async () => {
      await nft.mint(USER1, tokenId);
      await nft.approve(marketplace.address, tokenId, { from: USER1 });

      tokenContract = await marketplace.addToken.call("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        true,
        false,
      ]);
      await marketplace.addToken("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        true,
        false,
      ]);

      requestId = await marketplace.createNFTRequest.call(nft.address, tokenId, tokenContract, { from: USER1 });
      requestId = toBN(requestId);
      await marketplace.createNFTRequest(nft.address, tokenId, tokenContract, { from: USER1 });
    });

    it("should cancel NFT request", async () => {
      const tx = await marketplace.cancelNFTRequest(requestId, { from: USER1 });

      assert.equal(await nft.ownerOf(tokenId), USER1);

      assert.equal(tx.logs.length, 1);
      assert.equal(tx.logs[0].event, "NFTRequestCanceled");
      assert.equal(tx.logs[0].args.requestId.toString(), "0");
    });

    it("should revert if request is not exists", async () => {
      await truffleAssert.reverts(
        marketplace.cancelNFTRequest(1, { from: USER1 }),
        "Marketplace: Request ID is not valid."
      );
    });

    it("should revert if sender is not requester", async () => {
      await truffleAssert.reverts(
        marketplace.cancelNFTRequest(requestId, { from: NOTHING }),
        "Marketplace: Sender is not the requester."
      );
    });

    it("should revert if status of request is not valid", async () => {
      const sig = signBuyWithRequestTest({});

      await marketplace.buyTokenWithRequest([requestId, 0, defaultEndTime, defaultTokenURI], [sig.r, sig.s, sig.v], {
        from: USER1,
      });

      await truffleAssert.reverts(
        marketplace.cancelNFTRequest(requestId, { from: USER1 }),
        "Marketplace: Request status is not valid."
      );
    });
  });

  describe("buyTokenWithRequest()", () => {
    const tokenId = 13;
    let tokenContract;
    let requestId;

    beforeEach("setup", async () => {
      await nft.mint(USER1, tokenId);
      await nft.approve(marketplace.address, tokenId, { from: USER1 });

      tokenContract = await marketplace.addToken.call("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        true,
        false,
      ]);
      await marketplace.addToken("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        true,
        false,
      ]);

      requestId = await marketplace.createNFTRequest.call(nft.address, tokenId, tokenContract, { from: USER1 });
      requestId = toBN(requestId);
      await marketplace.createNFTRequest(nft.address, tokenId, tokenContract, { from: USER1 });
    });

    it("should buy token with NFT request", async () => {
      const sig = signBuyWithRequestTest({});

      const tx = await marketplace.buyTokenWithRequest(
        [requestId, 0, defaultEndTime, defaultTokenURI],
        [sig.r, sig.s, sig.v],
        { from: USER1 }
      );

      assert.equal(await nft.ownerOf(tokenId), marketplace.address);

      assert.equal(tx.logs.length, 1);
      assert.equal(tx.logs[0].event, "TokenSuccessfullyExchanged");
      assert.equal(tx.logs[0].args.recipient, USER1);
      assert.equal(tx.logs[0].args.buyParams.requestId.toString(), "0");
      assert.equal(tx.logs[0].args.buyParams.futureTokenId.toString(), 0);
      assert.equal(tx.logs[0].args.buyParams.endTimestamp, defaultEndTime);
      assert.equal(tx.logs[0].args.buyParams.tokenURI, defaultTokenURI);

      const token = await ERC721MintableToken.at(tokenContract);
      assert.equal(await token.tokenURI(0), defaultBaseURI + defaultTokenURI);
      assert.equal(await token.ownerOf(0), USER1);
    });

    it("should buy token with NFT request and send funds to recipient contract", async () => {
      const ERC721Holder_impl = await ERC721Holder.new();
      await marketplace.updateAllParams(tokenContract, "Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ERC721Holder_impl.address,
        true,
        false,
      ]);

      const sig = signBuyWithRequestTest({});

      const tx = await marketplace.buyTokenWithRequest(
        [requestId, 0, defaultEndTime, defaultTokenURI],
        [sig.r, sig.s, sig.v],
        { from: USER1 }
      );

      assert.equal(await nft.ownerOf(tokenId), ERC721Holder_impl.address);

      assert.equal(tx.logs.length, 1);
      assert.equal(tx.logs[0].event, "TokenSuccessfullyExchanged");
      assert.equal(tx.logs[0].args.recipient, USER1);
      assert.equal(tx.logs[0].args.buyParams.requestId.toString(), "0");
      assert.equal(tx.logs[0].args.buyParams.futureTokenId.toString(), 0);
      assert.equal(tx.logs[0].args.buyParams.endTimestamp, defaultEndTime);
      assert.equal(tx.logs[0].args.buyParams.tokenURI, defaultTokenURI);

      const token = await ERC721MintableToken.at(tokenContract);
      assert.equal(await token.tokenURI(0), defaultBaseURI + defaultTokenURI);
      assert.equal(await token.ownerOf(0), USER1);
    });

    it("should buy token with NFT request and send funds to recipient", async () => {
      await marketplace.updateAllParams(tokenContract, "Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        NOTHING,
        true,
        false,
      ]);

      const sig = signBuyWithRequestTest({});

      const tx = await marketplace.buyTokenWithRequest(
        [requestId, 0, defaultEndTime, defaultTokenURI],
        [sig.r, sig.s, sig.v],
        { from: USER1 }
      );

      assert.equal(await nft.ownerOf(tokenId), NOTHING);

      assert.equal(tx.logs.length, 1);
      assert.equal(tx.logs[0].event, "TokenSuccessfullyExchanged");
      assert.equal(tx.logs[0].args.recipient, USER1);
      assert.equal(tx.logs[0].args.buyParams.requestId.toString(), "0");
      assert.equal(tx.logs[0].args.buyParams.futureTokenId.toString(), 0);
      assert.equal(tx.logs[0].args.buyParams.endTimestamp, defaultEndTime);
      assert.equal(tx.logs[0].args.buyParams.tokenURI, defaultTokenURI);

      const token = await ERC721MintableToken.at(tokenContract);
      assert.equal(await token.tokenURI(0), defaultBaseURI + defaultTokenURI);
      assert.equal(await token.ownerOf(0), USER1);
    });

    it("should revert if signature is invalid", async () => {
      const sig = signBuyWithRequestTest({});

      await truffleAssert.reverts(
        marketplace.buyTokenWithRequest([requestId, 1, defaultEndTime, defaultTokenURI], [sig.r, sig.s, sig.v], {
          from: USER1,
        }),
        "Marketplace: Invalid signature."
      );
    });

    it("should revert if signature has expired", async () => {
      const sig = signBuyWithRequestTest({});

      await setNextBlockTime(defaultEndTime.plus(100).toNumber());

      await truffleAssert.reverts(
        marketplace.buyTokenWithRequest([requestId, 0, defaultEndTime, defaultTokenURI], [sig.r, sig.s, sig.v], {
          from: USER1,
        }),
        "Marketplace: Signature expired."
      );
    });

    it("should revert if request id is invalid", async () => {
      const sig = signBuyWithRequestTest({});

      await truffleAssert.reverts(
        marketplace.buyTokenWithRequest([requestId + 1, 0, defaultEndTime, defaultTokenURI], [sig.r, sig.s, sig.v], {
          from: USER1,
        }),
        "Marketplace: Request ID is not valid."
      );
    });

    it("should revert if requester is wrong", async () => {
      const sig = signBuyWithRequestTest({});

      await truffleAssert.reverts(
        marketplace.buyTokenWithRequest([requestId, 0, defaultEndTime, defaultTokenURI], [sig.r, sig.s, sig.v], {
          from: NOTHING,
        }),
        "Marketplace: Sender is not the requester."
      );
    });

    it("should revert if token is disabled", async () => {
      await marketplace.updateAllParams(tokenContract, "Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        NOTHING,
        true,
        true,
      ]);

      const sig = signBuyWithRequestTest({});

      await truffleAssert.reverts(
        marketplace.buyTokenWithRequest([requestId, 0, defaultEndTime, defaultTokenURI], [sig.r, sig.s, sig.v], {
          from: USER1,
        }),
        "Marketplace: Token is disabled."
      );
    });

    it("should revert if token is not NFT buyable", async () => {
      await marketplace.updateAllParams(tokenContract, "Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        NOTHING,
        false,
        false,
      ]);

      const sig = signBuyWithRequestTest({});

      await truffleAssert.reverts(
        marketplace.buyTokenWithRequest([requestId, 0, defaultEndTime, defaultTokenURI], [sig.r, sig.s, sig.v], {
          from: USER1,
        }),
        "Marketplace: This token cannot be purchased with NFT."
      );
    });
  });

  describe("getNFTRequestsPart", () => {
    it("should return correct requests", async () => {
      const requests = [];

      for (let i = 0; i < 5; i++) {
        const addr = await marketplace.addToken.call("Test" + i, "TST" + i, [
          i,
          defaultMinNFTFloorPrice,
          defaultVoucherTokensAmount,
          defaultVoucherContract.address,
          ZERO_ADDR,
          true,
          false,
        ]);
        await marketplace.addToken("Test" + i, "TST" + i, [
          i,
          defaultMinNFTFloorPrice,
          defaultVoucherTokensAmount,
          defaultVoucherContract.address,
          ZERO_ADDR,
          true,
          false,
        ]);

        await nft.mint(USER1, i);
        await nft.approve(marketplace.address, i, { from: USER1 });

        let requestId = await marketplace.createNFTRequest.call(nft.address, i, addr, { from: USER1 });
        await marketplace.createNFTRequest(nft.address, i, addr, { from: USER1 });
        requests.push([addr, nft.address, i.toString(), USER1, NFTRequestStatus.PENDING.toString()]);

        await nft.mint(USER1, (i + 1) * 100);
        await nft.approve(marketplace.address, (i + 1) * 100, { from: USER1 });

        requestId = await marketplace.createNFTRequest.call(nft.address, (i + 1) * 100, addr, { from: USER1 });
        await marketplace.createNFTRequest(nft.address, (i + 1) * 100, addr, { from: USER1 });
        await marketplace.cancelNFTRequest(requestId, { from: USER1 });
        requests.push([addr, nft.address, ((i + 1) * 100).toString(), USER1, NFTRequestStatus.CANCELED.toString()]);

        await nft.mint(USER1, (i + 1) * 1000);
        await nft.approve(marketplace.address, (i + 1) * 1000, { from: USER1 });

        requestId = await marketplace.createNFTRequest.call(nft.address, (i + 1) * 1000, addr, { from: USER1 });
        await marketplace.createNFTRequest(nft.address, (i + 1) * 1000, addr, { from: USER1 });
        const sig = signBuyWithRequestTest({ requestId: requestId.toNumber() });
        await marketplace.buyTokenWithRequest([requestId, 0, defaultEndTime, defaultTokenURI], [sig.r, sig.s, sig.v], {
          from: USER1,
        });
        requests.push([addr, nft.address, ((i + 1) * 1000).toString(), USER1, NFTRequestStatus.MINTED.toString()]);
      }

      assert.equal((await marketplace.getNFTRequestsCount()).toString(), "15");

      assert.deepEqual(await marketplace.getNFTRequestsPart(0, 30), requests);
      assert.deepEqual(await marketplace.getNFTRequestsPart(0, 3), requests.slice(0, 3));
      assert.deepEqual(await marketplace.getNFTRequestsPart(3, 30), requests.slice(3));
      assert.deepEqual(await marketplace.getNFTRequestsPart(30, 30), []);
    });
  });

  describe("getUserTokensPart()", () => {
    let tokenContract;
    let tokenContract2;

    beforeEach(async () => {
      tokenContract = await marketplace.addToken.call("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        false,
        false,
      ]);
      await marketplace.addToken("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        false,
        false,
      ]);

      tokenContract2 = await marketplace.addToken.call("Test2", "TST2", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        false,
        false,
      ]);
      await marketplace.addToken("Test2", "TST2", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        false,
        false,
      ]);
    });

    it("should return correct user tokens", async () => {
      const userTokens1 = [];

      for (let i = 0; i < 4; i++) {
        const sig = signBuyTest({
          tokenContract: tokenContract,
          futureTokenId: i,
          paymentTokenAddress: ZERO_ADDR,
          tokenURI: defaultTokenURI + i,
        });

        const expectedValueAmount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);

        await marketplace.buyTokenWithETH(
          [[ZERO_ADDR, tokenPrice, defaultDiscountValue, 0], tokenContract, i, defaultEndTime, defaultTokenURI + i],
          [sig.r, sig.s, sig.v],
          {
            from: USER1,
            value: expectedValueAmount,
          }
        );

        userTokens1.push(i.toString());
      }
      const userTokensInfo1 = [
        [tokenContract, userTokens1],
        [tokenContract2, []],
      ];
      const userTokensInfo2 = [
        [tokenContract, []],
        [tokenContract2, []],
      ];

      assert.deepEqual(await marketplace.getUserTokensPart(USER1, 0, 10), userTokensInfo1);
      assert.deepEqual(await marketplace.getUserTokensPart(USER1, 0, 3), userTokensInfo1.slice(0, 3));
      assert.deepEqual(await marketplace.getUserTokensPart(USER1, 3, 10), userTokensInfo1.slice(3));

      assert.deepEqual(await marketplace.getUserTokensPart(NOTHING, 0, 10), userTokensInfo2);
      assert.deepEqual(await marketplace.getUserTokensPart(NOTHING, 0, 3), userTokensInfo2.slice(0, 3));
      assert.deepEqual(await marketplace.getUserTokensPart(NOTHING, 3, 10), userTokensInfo2.slice(3));
    });
  });
});
