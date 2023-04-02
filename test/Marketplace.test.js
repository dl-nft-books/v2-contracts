const {assert} = require("chai");
const {wei, accounts, toBN} = require("../scripts/utils/utils");
const {ZERO_ADDR, PRECISION, PERCENTAGE_100} = require("../scripts/utils/constants");
const Reverter = require("./helpers/reverter");
const truffleAssert = require("truffle-assertions");
const {signBuy} = require("./helpers/signatures");
const {getCurrentBlockTime, setTime} = require("./helpers/block-helper");

const ContractsRegistry = artifacts.require("ContractsRegistry");
const TokenFactory = artifacts.require("TokenFactory");
const TokenRegistry = artifacts.require("TokenRegistry");
const RoleManager = artifacts.require("RoleManager");
const ERC721MintableToken = artifacts.require("ERC721MintableToken");
const Marketplace = artifacts.require("Marketplace");
const ERC20Mock = artifacts.require("ERC20Mock");
const ERC721Mock = artifacts.require("ERC721Mock");
const Attacker = artifacts.require("Attacker");
const ContractWithoutCallback = artifacts.require("ContractWithoutCallback");

TokenRegistry.numberFormat = "BigNumber";
Marketplace.numberFormat = "BigNumber";
ERC721MintableToken.numberFormat = "BigNumber";
ERC20Mock.numberFormat = "BigNumber";

describe("Marketplace", () => {
  let OWNER;
  const OWNER_PK = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const USER1_PK = "0e48c6349e2619d39b0f2c19b63e650718903a3146c7fb71f4c7761147b2a10b";
  let SECOND;
  let NOTHING;

  let marketplace;
  let contractsRegistry;
  let paymentToken;
  let nft;

  const priceDecimals = toBN(18);
  const tokenPrice = wei(500);
  const mintTokensAmount = wei(10000);
  const defaultPricePerOneToken = wei(100, priceDecimals);
  const defaultDiscountValue = 0;
  const signDuration = 10000;
  const defaultTokenURI = "some uri";
  const defaultBaseURI = "some base uri";
  let defaultVoucherContract;
  const defaultMinNFTFloorPrice = wei(80, priceDecimals);
  const defaultVoucherTokensAmount = wei(1);
  let defaultEndTime;

  const reverter = new Reverter();

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

  before("setup", async () => {
    OWNER = await accounts(0);
    SECOND = await accounts(1);
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
    marketplace = await Marketplace.at(await contractsRegistry.getMarketplaceContract());
    await (await RoleManager.at(await contractsRegistry.getRoleManagerContract())).__RoleManager_init();

    await contractsRegistry.injectDependencies(await contractsRegistry.TOKEN_FACTORY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.TOKEN_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.MARKETPLACE_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.ROLE_MANAGER_NAME());

    const tokenName = [await _tokenRegistry.TOKEN_POOL()];
    const tokenAddr = [(await ERC721MintableToken.new()).address];
    await tokenRegistry.setNewImplementations(tokenName, tokenAddr);

    await marketplace.__Marketplace_init(defaultBaseURI);

    paymentToken = await ERC20Mock.new("TestERC20", "TERC20", 18);
    await paymentToken.mint(OWNER, mintTokensAmount);
    await paymentToken.approve(marketplace.address, mintTokensAmount);
    await paymentToken.mint(SECOND, mintTokensAmount);
    await paymentToken.approve(marketplace.address, mintTokensAmount, {from: SECOND});

    nft = await ERC721Mock.new("Test NFT", "TNFT");

    defaultVoucherContract = await ERC20Mock.new("Test Voucher Token", "TVT", 18);

    defaultEndTime = toBN(await getCurrentBlockTime()).plus(signDuration);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("creation", () => {
    it("should set correct data after deployment", async () => {
    });

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
          [pricePerOneToken, minNFTFloorPrice, voucherTokensAmount, voucherTokenContract, fundsRecipient, isNFTBuyable, false],
          {from: NOTHING}
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

      const tokenParams = await marketplace.getDetailedTokenParams(tokenContract);
      assert.equal(tokenParams.pricePerOneToken, newPricePerOneToken);
      assert.equal(tokenParams.minNFTFloorPrice, newMinNFTFloorPrice);
      assert.equal(tokenParams.voucherTokensAmount, newVoucherTokensAmount);
      assert.equal(tokenParams.isNFTBuyable, newIsNFTBuyable);
      assert.equal(tokenParams.voucherTokenContract, newVoucherTokenContract);
      assert.equal(tokenParams.fundsRecipient, newFundsRecipient);
      assert.equal(tokenParams.isDisabled, true);

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
          {from: NOTHING}
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
      await nft.mint(SECOND, tokenId);
      await nft.approve(marketplace.address, tokenId, {from: SECOND});

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

      const sig = signBuyTest({tokenContract: tokenContract, paymentTokenAddress: ZERO_ADDR, paymentTokenPrice: "0"});

      await truffleAssert.reverts(
        marketplace.buyToken(
          tokenContract,
          0,
          ZERO_ADDR,
          0,
          defaultDiscountValue,
          defaultEndTime,
          defaultTokenURI,
          sig.r,
          sig.s,
          sig.v,
          {
            from: SECOND,
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
        marketplace.buyTokenByNFT(
          tokenContract,
          0,
          nft.address,
          nftFloorPrice,
          tokenId,
          defaultEndTime,
          newTokenURI,
          sigNft.r,
          sigNft.s,
          sigNft.v,
          {from: SECOND}
        ),
        reason
      );

      await marketplace.unpause();

      await marketplace.buyToken(
        tokenContract,
        0,
        ZERO_ADDR,
        0,
        defaultDiscountValue,
        defaultEndTime,
        defaultTokenURI,
        sig.r,
        sig.s,
        sig.v,
        {
          from: SECOND,
        }
      );

      await marketplace.buyTokenByNFT(
        tokenContract,
        1,
        nft.address,
        nftFloorPrice,
        tokenId,
        defaultEndTime,
        newTokenURI,
        sigNft.r,
        sigNft.s,
        sigNft.v,
        {from: SECOND}
      );

      const token = await ERC721MintableToken.at(tokenContract);

      assert.equal(await token.tokenURI(0), defaultBaseURI + defaultTokenURI);
      assert.equal(await token.tokenURI(1), defaultBaseURI + newTokenURI);

      assert.equal(await token.ownerOf(0), SECOND);
      assert.equal(await token.ownerOf(1), SECOND);
    });

    it("should get exception if non admin try to call this function", async () => {
      const reason = "Marketplace: Caller is not a marketplace manager.";

      await truffleAssert.reverts(marketplace.pause({from: SECOND}), reason);
      await truffleAssert.reverts(marketplace.unpause({from: SECOND}), reason);
    });
  });

  describe("withdrawPaidTokens()", () => {
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
    it("should withdraw ERC20 tokens", async () => {
      const newDecimals = 8;

      await paymentToken.setDecimals(newDecimals);

      const paymentTokenPrice = wei(10000);
      const sig = signBuyTest({tokenContract: tokenContract, paymentTokenPrice: paymentTokenPrice.toFixed()});

      const expectedPaymentAmount = defaultPricePerOneToken.times(wei(1)).idiv(paymentTokenPrice);
      const expectedTokensAmount = expectedPaymentAmount.idiv(wei(1, 10));

      await marketplace.buyToken(
        tokenContract,
        0,
        paymentToken.address,
        paymentTokenPrice,
        defaultDiscountValue,
        defaultEndTime,
        defaultTokenURI,
        sig.r,
        sig.s,
        sig.v,
        {
          from: SECOND,
        }
      );

      assert.equal((await paymentToken.balanceOf(marketplace.address)).toFixed(), expectedTokensAmount.toFixed());

      const tx = await marketplace.withdrawPaidTokens(paymentToken.address, OWNER);

      assert.equal(
        toBN(await paymentToken.balanceOf(OWNER)).toFixed(),
        mintTokensAmount.plus(expectedTokensAmount).toFixed()
      );

      assert.equal(tx.receipt.logs[0].event, "PaidTokensWithdrawn");
      assert.equal(tx.receipt.logs[0].args.tokenAddr, paymentToken.address);
      assert.equal(tx.receipt.logs[0].args.recipient, OWNER);
      assert.equal(toBN(tx.receipt.logs[0].args.amount).toFixed(), expectedPaymentAmount.toFixed());
    });

    it("should get exception if nothing to withdraw", async () => {
      const reason = "Marketplace: Nothing to withdraw.";

      await truffleAssert.reverts(marketplace.withdrawPaidTokens(paymentToken.address, SECOND), reason);
    });

    it("should get exception if no a withdrawal manager calls this function", async () => {
      const reason = "Marketplace: Caller is not a withdrawal manager.";

      await truffleAssert.reverts(marketplace.withdrawPaidTokens(ZERO_ADDR, SECOND, {from: SECOND}), reason);
    });
  });

  describe("withdrawNativeCurrency()", () => {
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

    it("should correctly withdraw native currency", async () => {
      const currencyPrice = wei(10000);
      const sig = signBuyTest({
        tokenContract: tokenContract,
        paymentTokenAddress: ZERO_ADDR,
        paymentTokenPrice: currencyPrice.toFixed(),
      });

      const expectedCurrencyAmount = defaultPricePerOneToken.times(wei(1)).idiv(currencyPrice);

      await marketplace.buyToken(
        tokenContract,
        0,
        ZERO_ADDR,
        currencyPrice,
        defaultDiscountValue,
        defaultEndTime,
        defaultTokenURI,
        sig.r,
        sig.s,
        sig.v,
        {
          from: SECOND,
          value: expectedCurrencyAmount,
        }
      );

      assert.equal(toBN(await web3.eth.getBalance(marketplace.address)).toFixed(), expectedCurrencyAmount.toFixed());

      const currencyBalanceBefore = toBN(await web3.eth.getBalance(SECOND));

      const tx = await marketplace.withdrawNativeCurrency(SECOND);

      const currencyBalanceAfter = toBN(await web3.eth.getBalance(SECOND));

      assert.equal(currencyBalanceAfter.minus(currencyBalanceBefore).toFixed(), expectedCurrencyAmount.toFixed());

      assert.equal(tx.receipt.logs[0].event, "NativeCurrencyWithdrawn");
      assert.equal(tx.receipt.logs[0].args.recipient, SECOND);
      assert.equal(toBN(tx.receipt.logs[0].args.amount).toFixed(), expectedCurrencyAmount.toFixed());
    });

    it("should get exception if failed to transfer native currency to the recipient", async () => {
      const reason = "Marketplace: Failed to transfer native currency.";

      const currencyPrice = wei(10000);
      const sig = signBuyTest({
        tokenContract: tokenContract,
        paymentTokenAddress: ZERO_ADDR,
        paymentTokenPrice: currencyPrice.toFixed(),
      });

      const expectedCurrencyAmount = defaultPricePerOneToken.times(wei(1)).idiv(currencyPrice);

      await marketplace.buyToken(
        tokenContract,
        0,
        ZERO_ADDR,
        currencyPrice,
        defaultDiscountValue,
        defaultEndTime,
        defaultTokenURI,
        sig.r,
        sig.s,
        sig.v,
        {
          from: SECOND,
          value: expectedCurrencyAmount,
        }
      );

      await truffleAssert.reverts(marketplace.withdrawNativeCurrency(marketplace.address), reason);
    });

    it("should get exception if nothing to withdraw", async () => {
      const reason = "Marketplace: Nothing to withdraw.";

      await truffleAssert.reverts(marketplace.withdrawNativeCurrency(SECOND), reason);
    });

    it("should get exception if no a withdrawal manager calls this function", async () => {
      const reason = "Marketplace: Caller is not a withdrawal manager.";

      await truffleAssert.reverts(marketplace.withdrawNativeCurrency(SECOND, {from: SECOND}), reason);
    });
  });

  describe("buyToken()", () => {
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

    it("should correctly buy token", async () => {
      let sig = signBuyTest({tokenContract: tokenContract, paymentTokenAddress: ZERO_ADDR, paymentTokenPrice: "0"});

      const tx = await marketplace.buyToken(
        tokenContract,
        0,
        ZERO_ADDR,
        0,
        defaultDiscountValue,
        defaultEndTime,
        defaultTokenURI,
        sig.r,
        sig.s,
        sig.v,
        {
          from: SECOND,
        }
      );

      assert.equal(tx.receipt.logs[0].event, "SuccessfullyMinted");
      assert.equal(tx.receipt.logs[0].args.tokenContract, tokenContract);
      assert.equal(tx.receipt.logs[0].args.recipient, SECOND);
      assert.equal(toBN(tx.receipt.logs[0].args.mintedTokenInfo.tokenId).toFixed(), 0);
      assert.equal(
        toBN(tx.receipt.logs[0].args.mintedTokenInfo.mintedTokenPrice).toFixed(),
        defaultPricePerOneToken.toFixed()
      );
      assert.equal(tx.receipt.logs[0].args.mintedTokenInfo.tokenURI, defaultTokenURI);
      assert.equal(tx.receipt.logs[0].args.paymentTokenAddress, ZERO_ADDR);
      assert.equal(toBN(tx.receipt.logs[0].args.paidTokensAmount).toFixed(), 0);
      assert.equal(toBN(tx.receipt.logs[0].args.paymentTokenPrice).toFixed(), 0);
      assert.equal(toBN(tx.receipt.logs[0].args.discount).toFixed(), 0);
      assert.equal(tx.receipt.logs[0].args.fundsRecipient, ZERO_ADDR);

      const token = await ERC721MintableToken.at(tokenContract);
      assert.equal(await token.tokenURI(0), defaultBaseURI + defaultTokenURI);
      assert.equal(await token.ownerOf(0), SECOND);
    });

    it("should correctly buy token with ETH and send currency to recipient address", async () => {
      const tokenContract2 = await marketplace.addToken.call("Test2", "TST2", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        NOTHING,
        false,
        false,
      ]);
      await marketplace.addToken("Test2", "TST2", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        NOTHING,
        false,
        false,
      ]);
      const balanceBefore = toBN(await web3.eth.getBalance(SECOND));
      const balanceBeforeRecipient = toBN(await web3.eth.getBalance(NOTHING));
      const sig = signBuyTest({tokenContract: tokenContract2, paymentTokenAddress: ZERO_ADDR});
      const expectedCurrencyCount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);

      const tx = await marketplace.buyToken(
        tokenContract2,
        0,
        ZERO_ADDR,
        tokenPrice,
        defaultDiscountValue,
        defaultEndTime,
        defaultTokenURI,
        sig.r,
        sig.s,
        sig.v,
        {
          from: SECOND,
          value: expectedCurrencyCount.times(1.5),
        }
      );

      const balanceAfter = toBN(await web3.eth.getBalance(SECOND));
      const balanceAfterRecipient = toBN(await web3.eth.getBalance(NOTHING));

      assert.closeTo(
        balanceBefore.minus(balanceAfter).toNumber(),
        expectedCurrencyCount.toNumber(),
        wei(0.001).toNumber()
      );

      assert.closeTo(
        balanceAfterRecipient.minus(balanceBeforeRecipient).toNumber(),
        expectedCurrencyCount.toNumber(),
        wei(0.001).toNumber()
      );

      assert.equal(tx.receipt.logs[0].event, "SuccessfullyMinted");
      assert.equal(tx.receipt.logs[0].args.tokenContract, tokenContract2);
      assert.equal(tx.receipt.logs[0].args.recipient, SECOND);
      assert.equal(tx.receipt.logs[0].args.paymentTokenAddress, ZERO_ADDR);
      assert.equal(toBN(tx.receipt.logs[0].args.paidTokensAmount).toFixed(), expectedCurrencyCount.toFixed());
      assert.equal(toBN(tx.receipt.logs[0].args.paymentTokenPrice).toFixed(), tokenPrice.toFixed());
      assert.equal(toBN(tx.receipt.logs[0].args.discount).toFixed(), 0);
      assert.equal(tx.receipt.logs[0].args.fundsRecipient, NOTHING);
    });

    it("should correctly buy token with ETH and send currency to recipient address if recipient is marketplace", async () => {
      const tokenContract2 = await marketplace.addToken.call("Test2", "TST2", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        marketplace.address,
        false,
        false,
      ]);
      await marketplace.addToken("Test2", "TST2", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        marketplace.address,
        false,
        false,
      ]);
      const balanceBefore = toBN(await web3.eth.getBalance(SECOND));
      const balanceBeforeRecipient = toBN(await web3.eth.getBalance(marketplace.address));
      const sig = signBuyTest({tokenContract: tokenContract2, paymentTokenAddress: ZERO_ADDR});
      const expectedCurrencyCount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);

      const tx = await marketplace.buyToken(
        tokenContract2,
        0,
        ZERO_ADDR,
        tokenPrice,
        defaultDiscountValue,
        defaultEndTime,
        defaultTokenURI,
        sig.r,
        sig.s,
        sig.v,
        {
          from: SECOND,
          value: expectedCurrencyCount.times(1.5),
        }
      );

      const balanceAfter = toBN(await web3.eth.getBalance(SECOND));
      const balanceAfterRecipient = toBN(await web3.eth.getBalance(marketplace.address));

      assert.closeTo(
        balanceBefore.minus(balanceAfter).toNumber(),
        expectedCurrencyCount.toNumber(),
        wei(0.001).toNumber()
      );

      assert.closeTo(
        balanceAfterRecipient.minus(balanceBeforeRecipient).toNumber(),
        expectedCurrencyCount.toNumber(),
        wei(0.001).toNumber()
      );

      assert.equal(tx.receipt.logs[0].event, "SuccessfullyMinted");
      assert.equal(tx.receipt.logs[0].args.tokenContract, tokenContract2);
      assert.equal(tx.receipt.logs[0].args.recipient, SECOND);
      assert.equal(tx.receipt.logs[0].args.paymentTokenAddress, ZERO_ADDR);
      assert.equal(toBN(tx.receipt.logs[0].args.paidTokensAmount).toFixed(), expectedCurrencyCount.toFixed());
      assert.equal(toBN(tx.receipt.logs[0].args.paymentTokenPrice).toFixed(), tokenPrice.toFixed());
      assert.equal(toBN(tx.receipt.logs[0].args.discount).toFixed(), 0);
      assert.equal(tx.receipt.logs[0].args.fundsRecipient, marketplace.address);
    });

    it("should correctly pay with ETH for new token with extra currency without discount", async () => {
      const balanceBefore = toBN(await web3.eth.getBalance(SECOND));
      const sig = signBuyTest({tokenContract: tokenContract, paymentTokenAddress: ZERO_ADDR});
      const expectedCurrencyCount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);

      const tx = await marketplace.buyToken(
        tokenContract,
        0,
        ZERO_ADDR,
        tokenPrice,
        defaultDiscountValue,
        defaultEndTime,
        defaultTokenURI,
        sig.r,
        sig.s,
        sig.v,
        {
          from: SECOND,
          value: expectedCurrencyCount.times(1.5),
        }
      );

      const balanceAfter = toBN(await web3.eth.getBalance(SECOND));

      assert.closeTo(
        balanceBefore.minus(balanceAfter).toNumber(),
        expectedCurrencyCount.toNumber(),
        wei(0.001).toNumber()
      );

      assert.equal(tx.receipt.logs[0].event, "SuccessfullyMinted");
      assert.equal(tx.receipt.logs[0].args.tokenContract, tokenContract);
      assert.equal(tx.receipt.logs[0].args.recipient, SECOND);
      assert.equal(tx.receipt.logs[0].args.paymentTokenAddress, ZERO_ADDR);
      assert.equal(toBN(tx.receipt.logs[0].args.paidTokensAmount).toFixed(), expectedCurrencyCount.toFixed());
      assert.equal(toBN(tx.receipt.logs[0].args.paymentTokenPrice).toFixed(), tokenPrice.toFixed());
      assert.equal(toBN(tx.receipt.logs[0].args.discount).toFixed(), 0);
      assert.equal(tx.receipt.logs[0].args.fundsRecipient, ZERO_ADDR);
    });

    it("should correctly pay with ETH for new token with extra currency with discount", async () => {
      const balanceBefore = toBN(await web3.eth.getBalance(SECOND));

      const sig = signBuyTest({
        tokenContract: tokenContract,
        paymentTokenAddress: ZERO_ADDR,
        discount: wei(30, 25).toFixed(),
      });
      const expectedCurrencyCount = defaultPricePerOneToken
        .times(wei(1))
        .idiv(tokenPrice)
        .times(100 - 30)
        .times(PRECISION)
        .idiv(PERCENTAGE_100);

      const tx = await marketplace.buyToken(
        tokenContract,
        0,
        ZERO_ADDR,
        tokenPrice,
        wei(30, 25), //30% discount
        defaultEndTime,
        defaultTokenURI,
        sig.r,
        sig.s,
        sig.v,
        {
          from: SECOND,
          value: expectedCurrencyCount.times(1.5),
        }
      );

      const balanceAfter = toBN(await web3.eth.getBalance(SECOND));

      assert.closeTo(
        balanceBefore.minus(balanceAfter).toNumber(),
        expectedCurrencyCount.toNumber(),
        wei(0.001).toNumber()
      );

      assert.equal(tx.receipt.logs[0].event, "SuccessfullyMinted");
      assert.equal(tx.receipt.logs[0].args.tokenContract, tokenContract);
      assert.equal(tx.receipt.logs[0].args.recipient, SECOND);
      assert.equal(tx.receipt.logs[0].args.paymentTokenAddress, ZERO_ADDR);
      assert.equal(toBN(tx.receipt.logs[0].args.paidTokensAmount).toFixed(), expectedCurrencyCount.toFixed());
      assert.equal(toBN(tx.receipt.logs[0].args.paymentTokenPrice).toFixed(), tokenPrice.toFixed());
      assert.equal(toBN(tx.receipt.logs[0].args.discount).toFixed(), wei(30, 25).toFixed());
      assert.equal(tx.receipt.logs[0].args.fundsRecipient, ZERO_ADDR);
    });

    it("should correctly pay with ETH without extra currency without discount", async () => {
      const balanceBefore = toBN(await web3.eth.getBalance(SECOND));

      const sig = signBuyTest({tokenContract: tokenContract, paymentTokenAddress: ZERO_ADDR});
      const expectedCurrencyCount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);

      const tx = await marketplace.buyToken(
        tokenContract,
        0,
        ZERO_ADDR,
        tokenPrice,
        defaultDiscountValue,
        defaultEndTime,
        defaultTokenURI,
        sig.r,
        sig.s,
        sig.v,
        {
          from: SECOND,
          value: expectedCurrencyCount,
        }
      );

      const balanceAfter = toBN(await web3.eth.getBalance(SECOND));

      assert.closeTo(
        balanceBefore.minus(balanceAfter).toNumber(),
        expectedCurrencyCount.toNumber(),
        wei(0.001).toNumber()
      );

      const token = await ERC721MintableToken.at(tokenContract);

      assert.equal(await token.tokenURI(0), defaultBaseURI + defaultTokenURI);
      assert.equal(await token.ownerOf(0), SECOND);

      assert.equal(tx.receipt.logs[0].event, "SuccessfullyMinted");
      assert.equal(tx.receipt.logs[0].args.tokenContract, tokenContract);
      assert.equal(tx.receipt.logs[0].args.recipient, SECOND);
      assert.equal(tx.receipt.logs[0].args.paymentTokenAddress, ZERO_ADDR);
      assert.equal(toBN(tx.receipt.logs[0].args.paidTokensAmount).toFixed(), expectedCurrencyCount.toFixed());
      assert.equal(toBN(tx.receipt.logs[0].args.paymentTokenPrice).toFixed(), tokenPrice.toFixed());
      assert.equal(toBN(tx.receipt.logs[0].args.discount).toFixed(), 0);
      assert.equal(tx.receipt.logs[0].args.fundsRecipient, ZERO_ADDR);
    });

    it("should correctly pay with ETH without extra currency with discount", async () => {
      const balanceBefore = toBN(await web3.eth.getBalance(SECOND));

      const sig = signBuyTest({
        tokenContract: tokenContract,
        paymentTokenAddress: ZERO_ADDR,
        discount: wei(20, 25).toFixed(),
      });
      const expectedCurrencyCount = defaultPricePerOneToken
        .times(wei(1))
        .idiv(tokenPrice)
        .times(100 - 20)
        .times(PRECISION)
        .idiv(PERCENTAGE_100);

      const tx = await marketplace.buyToken(
        tokenContract,
        0,
        ZERO_ADDR,
        tokenPrice,
        wei(20, 25), //20% discount
        defaultEndTime,
        defaultTokenURI,
        sig.r,
        sig.s,
        sig.v,
        {
          from: SECOND,
          value: expectedCurrencyCount,
        }
      );

      const balanceAfter = toBN(await web3.eth.getBalance(SECOND));

      assert.closeTo(
        balanceBefore.minus(balanceAfter).toNumber(),
        expectedCurrencyCount.toNumber(),
        wei(0.001).toNumber()
      );

      const token = await ERC721MintableToken.at(tokenContract);

      assert.equal(await token.tokenURI(0), defaultBaseURI + defaultTokenURI);
      assert.equal(await token.ownerOf(0), SECOND);

      assert.equal(tx.receipt.logs[0].event, "SuccessfullyMinted");
      assert.equal(tx.receipt.logs[0].args.tokenContract, tokenContract);
      assert.equal(tx.receipt.logs[0].args.recipient, SECOND);
      assert.equal(tx.receipt.logs[0].args.paymentTokenAddress, ZERO_ADDR);
      assert.equal(toBN(tx.receipt.logs[0].args.paidTokensAmount).toFixed(), expectedCurrencyCount.toFixed());
      assert.equal(toBN(tx.receipt.logs[0].args.paymentTokenPrice).toFixed(), tokenPrice.toFixed());
      assert.equal(toBN(tx.receipt.logs[0].args.discount).toFixed(), wei(20, 25).toFixed());
      assert.equal(tx.receipt.logs[0].args.fundsRecipient, ZERO_ADDR);
    });

    it("should correctly pay with ERC20 for new token without discount", async () => {
      const sig = signBuyTest({tokenContract: tokenContract});
      const expectedTokensCount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);

      const tx = await marketplace.buyToken(
        tokenContract,
        0,
        paymentToken.address,
        tokenPrice,
        defaultDiscountValue,
        defaultEndTime,
        defaultTokenURI,
        sig.r,
        sig.s,
        sig.v,
        {
          from: SECOND,
        }
      );

      assert.equal(
        (await paymentToken.balanceOf(SECOND)).toFixed(),
        mintTokensAmount.minus(expectedTokensCount).toFixed()
      );

      const token = await ERC721MintableToken.at(tokenContract);

      assert.equal(await token.ownerOf(0), SECOND);

      assert.equal(tx.receipt.logs[0].event, "SuccessfullyMinted");
      assert.equal(tx.receipt.logs[0].args.tokenContract, tokenContract);
      assert.equal(tx.receipt.logs[0].args.recipient, SECOND);
      assert.equal(tx.receipt.logs[0].args.paymentTokenAddress, paymentToken.address);
      assert.equal(toBN(tx.receipt.logs[0].args.paidTokensAmount).toFixed(), expectedTokensCount.toFixed());
      assert.equal(toBN(tx.receipt.logs[0].args.paymentTokenPrice).toFixed(), tokenPrice.toFixed());
      assert.equal(toBN(tx.receipt.logs[0].args.discount).toFixed(), 0);
      assert.equal(tx.receipt.logs[0].args.fundsRecipient, ZERO_ADDR);
    });

    it("should correctly pay with ERC20 for new token with discount", async () => {
      const sig = signBuyTest({tokenContract: tokenContract, discount: wei(50, 25).toFixed()});
      const expectedTokensCount = defaultPricePerOneToken
        .times(wei(1))
        .idiv(tokenPrice)
        .times(100 - 50)
        .times(PRECISION)
        .idiv(PERCENTAGE_100);

      const tx = await marketplace.buyToken(
        tokenContract,
        0,
        paymentToken.address,
        tokenPrice,
        wei(50, 25),
        defaultEndTime,
        defaultTokenURI,
        sig.r,
        sig.s,
        sig.v,
        {
          from: SECOND,
        }
      );

      assert.equal(
        (await paymentToken.balanceOf(SECOND)).toFixed(),
        mintTokensAmount.minus(expectedTokensCount).toFixed()
      );

      const token = await ERC721MintableToken.at(tokenContract);

      assert.equal(await token.ownerOf(0), SECOND);

      assert.equal(tx.receipt.logs[0].event, "SuccessfullyMinted");
      assert.equal(tx.receipt.logs[0].args.tokenContract, tokenContract);
      assert.equal(tx.receipt.logs[0].args.recipient, SECOND);
      assert.equal(tx.receipt.logs[0].args.paymentTokenAddress, paymentToken.address);
      assert.equal(toBN(tx.receipt.logs[0].args.paidTokensAmount).toFixed(), expectedTokensCount.toFixed());
      assert.equal(toBN(tx.receipt.logs[0].args.paymentTokenPrice).toFixed(), tokenPrice.toFixed());
      assert.equal(toBN(tx.receipt.logs[0].args.discount).toFixed(), wei(50, 25).toFixed());
      assert.equal(tx.receipt.logs[0].args.fundsRecipient, ZERO_ADDR);
    });

    it("should correctly pay with voucher token for new token", async () => {
      await defaultVoucherContract.mint(SECOND, mintTokensAmount);
      await defaultVoucherContract.approve(marketplace.address, mintTokensAmount, {from: SECOND});

      const sig = signBuyTest({
        tokenContract: tokenContract,
        paymentTokenAddress: defaultVoucherContract.address,
        paymentTokenPrice: 0,
      });

      const tx = await marketplace.buyToken(
        tokenContract,
        0,
        defaultVoucherContract.address,
        0,
        defaultDiscountValue,
        defaultEndTime,
        defaultTokenURI,
        sig.r,
        sig.s,
        sig.v,
        {
          from: SECOND,
        }
      );

      assert.equal(
        (await defaultVoucherContract.balanceOf(SECOND)).toFixed(),
        mintTokensAmount.minus(defaultVoucherTokensAmount).toFixed()
      );

      const token = await ERC721MintableToken.at(tokenContract);

      assert.equal(await token.ownerOf(0), SECOND);

      assert.equal(tx.receipt.logs[0].event, "SuccessfullyMinted");
      assert.equal(tx.receipt.logs[0].args.tokenContract, tokenContract);
      assert.equal(tx.receipt.logs[0].args.recipient, SECOND);
      assert.equal(tx.receipt.logs[0].args.paymentTokenAddress, defaultVoucherContract.address);
      assert.equal(toBN(tx.receipt.logs[0].args.paidTokensAmount).toFixed(), defaultVoucherTokensAmount.toFixed());
      assert.equal(toBN(tx.receipt.logs[0].args.paymentTokenPrice).toFixed(), "0");
      assert.equal(toBN(tx.receipt.logs[0].args.discount).toFixed(), 0);
      assert.equal(tx.receipt.logs[0].args.fundsRecipient, ZERO_ADDR);
    });

    it("should get exception if transfer currency failed", async () => {
      const reason = "Marketplace: Failed to return currency.";

      const sig = signBuyTest({tokenContract: tokenContract, paymentTokenAddress: ZERO_ADDR});
      const expectedCurrencyCount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);

      const attacker = await Attacker.new(marketplace.address, [
        tokenContract,
        0,
        expectedCurrencyCount,
        ZERO_ADDR,
        tokenPrice,
        defaultDiscountValue,
        defaultEndTime,
        defaultTokenURI,
        sig.r,
        sig.s,
        sig.v,
      ]);

      await truffleAssert.reverts(attacker.buyToken({from: SECOND, value: expectedCurrencyCount.times(2)}), reason);
    });

    it("should get exception if try to send currency when user needs to pay with ERC20 or voucher", async () => {
      let sig = signBuyTest({tokenContract: tokenContract});
      const expectedTokensCount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);

      const reason = "Marketplace: Currency amount must be a zero.";

      await truffleAssert.reverts(
        marketplace.buyToken(
          tokenContract,
          0,
          paymentToken.address,
          tokenPrice,
          defaultDiscountValue,
          defaultEndTime,
          defaultTokenURI,
          sig.r,
          sig.s,
          sig.v,
          {
            from: SECOND,
            value: expectedTokensCount,
          }
        ),
        reason
      );

      sig = signBuyTest({
        tokenContract: tokenContract,
        paymentTokenAddress: defaultVoucherContract.address,
        paymentTokenPrice: 0,
      });

      await truffleAssert.reverts(
        marketplace.buyToken(
          tokenContract,
          0,
          defaultVoucherContract.address,
          0,
          defaultDiscountValue,
          defaultEndTime,
          defaultTokenURI,
          sig.r,
          sig.s,
          sig.v,
          {
            from: SECOND,
            value: expectedTokensCount,
          }
        ),
        reason
      );
    });

    it("should get exception if send currency less than needed", async () => {
      const reason = "Marketplace: Invalid currency amount.";

      const sig = signBuyTest({tokenContract: tokenContract, paymentTokenAddress: ZERO_ADDR});
      const expectedCurrencyCount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);

      await truffleAssert.reverts(
        marketplace.buyToken(
          tokenContract,
          0,
          ZERO_ADDR,
          tokenPrice,
          defaultDiscountValue,
          defaultEndTime,
          defaultTokenURI,
          sig.r,
          sig.s,
          sig.v,
          {
            from: SECOND,
            value: expectedCurrencyCount.idiv(2),
          }
        ),
        reason
      );
    });

    it("should get exception if try to mint new token with the same token URI", async () => {
      const reason = "ERC721MintableToken: Token with such URI already exists.";

      let sig = signBuyTest({tokenContract: tokenContract});

      await marketplace.buyToken(
        tokenContract,
        0,
        paymentToken.address,
        tokenPrice,
        defaultDiscountValue,
        defaultEndTime,
        defaultTokenURI,
        sig.r,
        sig.s,
        sig.v,
        {from: SECOND}
      );

      sig = signBuyTest({tokenContract: tokenContract, futureTokenId: 1});

      await truffleAssert.reverts(
        marketplace.buyToken(
          tokenContract,
          1,
          paymentToken.address,
          tokenPrice,
          defaultDiscountValue,
          defaultEndTime,
          defaultTokenURI,
          sig.r,
          sig.s,
          sig.v,
          {from: SECOND}
        ),
        reason
      );
    });

    it("should get exception if recipient cannot obtain money", async () => {
      const contractWithoutCallback = await ContractWithoutCallback.new();
      const tokenContract2 = await marketplace.addToken.call("Test2", "TST2", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        contractWithoutCallback.address,
        false,
        false,
      ]);
      await marketplace.addToken("Test2", "TST2", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        contractWithoutCallback.address,
        false,
        false,
      ]);

      const expectedCurrencyCount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);
      const sig = signBuyTest({tokenContract: tokenContract2, paymentTokenAddress: ZERO_ADDR});
      await truffleAssert.reverts(
        marketplace.buyToken(
          tokenContract2,
          0,
          ZERO_ADDR,
          tokenPrice,
          defaultDiscountValue,
          defaultEndTime,
          defaultTokenURI,
          sig.r,
          sig.s,
          sig.v,
          {
            from: SECOND,
            value: expectedCurrencyCount.times(1.5),
          }
        ),
        "Marketplace: Failed to send currency to recipient."
      );
    });

    it("should get exception if signature is invalid", async () => {
      const reason = "Marketplace: Invalid signature.";

      const sig = signBuyTest({tokenContract: tokenContract, privateKey: USER1_PK});

      await truffleAssert.reverts(
        marketplace.buyToken(
          tokenContract,
          0,
          paymentToken.address,
          tokenPrice,
          defaultDiscountValue,
          defaultEndTime,
          defaultTokenURI,
          sig.r,
          sig.s,
          sig.v,
          {from: SECOND}
        ),
        reason
      );
    });

    it("should get exception if signature expired", async () => {
      const reason = "Marketplace: Signature expired.";

      const sig = signBuyTest({tokenContract: tokenContract});

      await setTime(defaultEndTime.plus(100).toNumber());

      await truffleAssert.reverts(
        marketplace.buyToken(
          tokenContract,
          0,
          paymentToken.address,
          tokenPrice,
          defaultDiscountValue,
          defaultEndTime,
          defaultTokenURI,
          sig.r,
          sig.s,
          sig.v,
          {from: SECOND}
        ),
        reason
      );
    });
  });

  describe("buyTokenByNFT()", () => {
    const tokenId = 13;
    const nftFloorPrice = wei(90, priceDecimals);
    let tokenContract;

    beforeEach("setup", async () => {
      await nft.mint(SECOND, tokenId);
      await nft.approve(marketplace.address, tokenId, {from: SECOND});

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

    it("should correctly mint token by NFT", async () => {
      const sig = signBuyTest({
        tokenContract: tokenContract,
        paymentTokenAddress: nft.address,
        paymentTokenPrice: nftFloorPrice.toFixed(),
      });

      const tx = await marketplace.buyTokenByNFT(
        tokenContract,
        0,
        nft.address,
        nftFloorPrice,
        tokenId,
        defaultEndTime,
        defaultTokenURI,
        sig.r,
        sig.s,
        sig.v,
        {from: SECOND}
      );

      assert.equal(await nft.ownerOf(tokenId), marketplace.address);
      const token = await ERC721MintableToken.at(tokenContract);
      assert.equal(await token.ownerOf(0), SECOND);

      assert.equal(tx.receipt.logs[0].event, "SuccessfullyMintedByNFT");
      assert.equal(tx.receipt.logs[0].args.recipient, SECOND);
      assert.equal(toBN(tx.receipt.logs[0].args.mintedTokenInfo.tokenId).toFixed(), 0);
      assert.equal(
        toBN(tx.receipt.logs[0].args.mintedTokenInfo.mintedTokenPrice).toFixed(),
        defaultMinNFTFloorPrice.toFixed()
      );
      assert.equal(tx.receipt.logs[0].args.mintedTokenInfo.tokenURI, defaultTokenURI);
      assert.equal(tx.receipt.logs[0].args.nftAddress, nft.address);
      assert.equal(toBN(tx.receipt.logs[0].args.tokenId).toFixed(), tokenId.toFixed());
      assert.equal(toBN(tx.receipt.logs[0].args.nftFloorPrice).toFixed(), nftFloorPrice.toFixed());
      assert.equal(tx.receipt.logs[0].args.fundsRecipient, ZERO_ADDR);
    });

    it("should get exception if the nft floor price is less than the minimum", async () => {
      const reason = "Marketplace: NFT floor price is less than the minimal.";

      const newNFTFloorPrice = wei(50, priceDecimals);

      const sig = signBuyTest({
        tokenContract: tokenContract,
        paymentTokenAddress: nft.address,
        paymentTokenPrice: newNFTFloorPrice.toFixed(),
      });

      await truffleAssert.reverts(
        marketplace.buyTokenByNFT(
          tokenContract,
          0,
          nft.address,
          newNFTFloorPrice,
          tokenId,
          defaultEndTime,
          defaultTokenURI,
          sig.r,
          sig.s,
          sig.v,
          {from: SECOND}
        ),
        reason
      );
    });

    it("should get exception if sender is not the owner of the nft", async () => {
      const reason = "Marketplace: Sender is not the owner.";

      const sig = signBuyTest({
        tokenContract: tokenContract,
        paymentTokenAddress: nft.address,
        paymentTokenPrice: nftFloorPrice.toFixed(),
      });

      await truffleAssert.reverts(
        marketplace.buyTokenByNFT(
          tokenContract,
          0,
          nft.address,
          nftFloorPrice,
          tokenId,
          defaultEndTime,
          defaultTokenURI,
          sig.r,
          sig.s,
          sig.v,
          {from: OWNER}
        ),
        reason
      );
    });

    it("should get exception if token is not NFT buyable", async () => {
      tokenContract = await marketplace.addToken.call("Test2", "TST2", [
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

      const reason = "Marketplace: This token cannot be purchased with NFT.";

      const sig = signBuyTest({
        tokenContract: tokenContract,
        tokenFutureId: 1,
        paymentTokenAddress: nft.address,
        paymentTokenPrice: nftFloorPrice.toFixed(),
      });

      await truffleAssert.reverts(
        marketplace.buyTokenByNFT(
          tokenContract,
          1,
          nft.address,
          nftFloorPrice,
          tokenId,
          defaultEndTime,
          defaultTokenURI,
          sig.r,
          sig.s,
          sig.v,
          {from: OWNER}
        ),
        reason
      );
    });

    //   it("should get exception if try to reenter in mint function", async () => {
    //     const reason = "ReentrancyGuard: reentrant call";

    //     const maliciousERC721 = await MaliciousERC721.new(marketplace.address);

    //     const sig = signBuyTest({
    //       tokenContract: tokenContract,
    //       paymentTokenAddress: maliciousERC721.address,
    //       paymentTokenPrice: nftFloorPrice.toFixed(),
    //     });

    //     await maliciousERC721.setParams([tokenContract, 0, nftFloorPrice, tokenId, defaultEndTime, defaultTokenURI, sig.r, sig.s, sig.v]);

    //     await truffleAssert.reverts(maliciousERC721.mintToken({ from: SECOND }), reason);
    //   });
  });

  describe("getUserTokenIDs", () => {
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

    it("should return correct user token IDs arr", async () => {
      let sig = signBuyTest({tokenContract: tokenContract, paymentTokenAddress: ZERO_ADDR, paymentTokenPrice: "0"});

      await marketplace.buyToken(
        tokenContract,
        0,
        ZERO_ADDR,
        0,
        defaultDiscountValue,
        defaultEndTime,
        defaultTokenURI,
        sig.r,
        sig.s,
        sig.v,
        {
          from: OWNER,
        }
      );

      sig = signBuyTest({
        tokenContract: tokenContract,
        futureTokenId: 1,
        paymentTokenAddress: ZERO_ADDR,
        paymentTokenPrice: "0",
        tokenURI: defaultTokenURI + 1,
      });

      await marketplace.buyToken(
        tokenContract,
        1,
        ZERO_ADDR,
        0,
        defaultDiscountValue,
        defaultEndTime,
        defaultTokenURI + 1,
        sig.r,
        sig.s,
        sig.v,
        {
          from: SECOND,
        }
      );

      sig = signBuyTest({
        tokenContract: tokenContract,
        futureTokenId: 2,
        paymentTokenAddress: ZERO_ADDR,
        paymentTokenPrice: "0",
        tokenURI: defaultTokenURI + 2,
      });

      await marketplace.buyToken(
        tokenContract,
        2,
        ZERO_ADDR,
        0,
        defaultDiscountValue,
        defaultEndTime,
        defaultTokenURI + 2,
        sig.r,
        sig.s,
        sig.v,
        {
          from: OWNER,
        }
      );

      let tokenIDs = await marketplace.getUserTokenIDs(tokenContract, OWNER);
      assert.deepEqual([tokenIDs[0].toString(), tokenIDs[1].toString()], ["0", "2"]);

      tokenIDs = await marketplace.getUserTokenIDs(tokenContract, SECOND);
      assert.deepEqual([tokenIDs[0].toString()], ["1"]);
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

      await truffleAssert.reverts(marketplace.setBaseTokenContractsURI("", {from: NOTHING}), reason);
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

  describe("getActiveTokenContractsPart", () => {
    it("should return correct active token contracts arr", async () => {
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

        addr = await marketplace.addToken.call("Test2" + i, "TST2" + i, [
          defaultPricePerOneToken,
          defaultMinNFTFloorPrice,
          defaultVoucherTokensAmount,
          defaultVoucherContract.address,
          ZERO_ADDR,
          false,
          false,
        ]);
        await marketplace.addToken("Test2" + i, "TST2" + i, [
          defaultPricePerOneToken,
          defaultMinNFTFloorPrice,
          defaultVoucherTokensAmount,
          defaultVoucherContract.address,
          ZERO_ADDR,
          false,
          false,
        ]);
        await marketplace.updateAllParams(addr, "Test2" + i, "TST2" + i, [
          defaultPricePerOneToken,
          defaultMinNFTFloorPrice,
          defaultVoucherTokensAmount,
          defaultVoucherContract.address,
          ZERO_ADDR,
          false,
          true,
        ]);
        
        assert.equal((await marketplace.getTokenContractsCount()).toString(), (i + 1) * 2);
        assert.equal((await marketplace.getActiveTokenContractsCount()).toString(), i + 1);
      }

      assert.deepEqual(await marketplace.getActiveTokenContractsPart(0, 10), addressesArr);
      assert.deepEqual(await marketplace.getActiveTokenContractsPart(0, 3), addressesArr.slice(0, 3));
      assert.deepEqual(await marketplace.getActiveTokenContractsPart(3, 10), addressesArr.slice(3));
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
        await marketplace.addToken("Test" + i, "TST" + i, tokenParam);
        baseTokenParams.push([i.toString(), "Test" + i]);
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
          i.toString(),
          defaultMinNFTFloorPrice.toString(),
          defaultVoucherTokensAmount.toString(),
          defaultVoucherContract.address,
          ZERO_ADDR,
          false,
          false,
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
});
