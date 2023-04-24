const { assert } = require("chai");
const { wei, accounts, toBN } = require("../scripts/utils/utils");
const { ZERO_ADDR, PRECISION, PERCENTAGE_100 } = require("../scripts/utils/constants");
const { signBuy, signBuyWithRequest, signPermit } = require("./helpers/signatures");
const { parseConfig } = require("../deploy/helpers/deployHelper");
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
const Voucher = artifacts.require("Voucher");

TokenRegistry.numberFormat = "BigNumber";
Marketplace.numberFormat = "BigNumber";
ERC721MintableToken.numberFormat = "BigNumber";
ERC20Mock.numberFormat = "BigNumber";
Voucher.numberFormat = "BigNumber";

describe("Marketplace", () => {
  const reverter = new Reverter();

  const OWNER_PK = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const USER1_PK = "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

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
  let USER2;
  let NOTHING;

  let marketplace;
  let contractsRegistry;
  let tokenRegistry;
  let paymentToken;
  let nft;
  let nft2;

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
    ACCEPTED: 2,
    CANCELED: 3,
  };

  function signBuyTest({
    privateKey = OWNER_PK,
    tokenRecipient = USER1,
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
      tokenRecipient: tokenRecipient,
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
    tokenRecipient = USER1,
    requestId = 1,
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
      tokenRecipient: tokenRecipient,
      requestId: requestId,
      futureTokenId: futureTokenId,
      endTimestamp: endTimestamp,
      tokenURI: web3.utils.soliditySha3(tokenURI),
    };

    return signBuyWithRequest(domain, buyWithRequest, buffer);
  }

  function signPermitTest({
    verifyingContract,
    privateKey = USER1_PK,
    owner = USER1,
    spender = marketplace.address,
    value = defaultVoucherTokensAmount.toFixed(),
    nonce = 0,
    deadline = defaultEndTime.toFixed(),
  }) {
    const buffer = Buffer.from(privateKey, "hex");

    const domain = {
      name: "Voucher",
      verifyingContract: verifyingContract,
    };

    const permit = {
      owner: owner,
      spender: spender,
      value: value,
      nonce: nonce,
      deadline: deadline,
    };

    return signPermit(domain, permit, buffer);
  }

  before("setup", async () => {
    OWNER = await accounts(0);
    USER1 = await accounts(1);
    USER2 = await accounts(2);
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

    const roleManager = await RoleManager.at(await contractsRegistry.getRoleManagerContract());
    tokenRegistry = await TokenRegistry.at(await contractsRegistry.getTokenRegistryContract());
    marketplace = await Marketplace.at(await contractsRegistry.getMarketplaceContract());

    const config = parseConfig("./test/data/config.test.json");
    await roleManager.__RoleManager_init(config.roleInitParams);

    await contractsRegistry.injectDependencies(await contractsRegistry.TOKEN_FACTORY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.TOKEN_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.MARKETPLACE_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.ROLE_MANAGER_NAME());

    const tokenName = [await _tokenRegistry.TOKEN_CONTRACT(), await _tokenRegistry.VOUCHER_TOKEN()];
    const tokenAddr = [(await ERC721MintableToken.new()).address, (await Voucher.new()).address];
    await tokenRegistry.setNewImplementations(tokenName, tokenAddr);

    await marketplace.__Marketplace_init(defaultBaseURI);

    paymentToken = await deployERC20("TestERC20", "TERC20", [OWNER, USER1]);

    nft = await ERC721Mock.new("Test NFT", "TNFT");
    nft2 = await ERC721Mock.new("Test NFT2", "TNFT2");

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

  describe("addToken", () => {
    const name = "Test";
    const symbol = "TST";
    const pricePerOneToken = wei(100);
    const minNFTFloorPrice = wei(100, priceDecimals);
    const voucherTokensAmount = wei(0);
    const isNFTBuyable = false;
    const isDisabled = false;
    const isVoucherBuyable = false;
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
        isDisabled,
        isVoucherBuyable,
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
      assert.equal(tx.logs[0].args.tokenParams.isDisabled, isDisabled);
      assert.equal(tx.logs[0].args.tokenParams.isVoucherBuyable, isVoucherBuyable);

      const token = await ERC721MintableToken.at(tx.logs[0].args.tokenContract);
      assert.equal(await token.name(), name);
      assert.equal(await token.symbol(), symbol);
    });

    it("should correctly add token with voucher", async () => {
      const newVoucherTokensAmount = wei(1);

      await marketplace.addToken(name, symbol, [
        pricePerOneToken,
        minNFTFloorPrice,
        newVoucherTokensAmount,
        voucherTokenContract,
        fundsRecipient,
        isNFTBuyable,
        isDisabled,
        true,
      ]);

      const voucherContract = await Voucher.at(
        (
          await marketplace.getDetailedTokenInfoPart(0, 10)
        )[0].tokenParams.voucherTokenContract
      );

      assert.equal(await voucherContract.name(), name + "_Voucher");
      assert.equal(await voucherContract.symbol(), symbol + "_V");
      assert.isTrue(await tokenRegistry.isVoucherToken(voucherContract.address));
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
            isDisabled,
            isVoucherBuyable,
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
          isDisabled,
          isVoucherBuyable,
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
          isDisabled,
          isVoucherBuyable,
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
          isVoucherBuyable,
        ]),
        "Marketplace: Token can not be disabled on creation."
      );
    });

    it("should return if isVoucherBuyable is true and voucherTokensAmount is 0", async () => {
      await truffleAssert.reverts(
        marketplace.addToken(name, symbol, [
          pricePerOneToken,
          minNFTFloorPrice,
          0,
          voucherTokenContract,
          fundsRecipient,
          isNFTBuyable,
          isDisabled,
          true,
        ]),
        "Marketplace: Invalid voucher params."
      );
    });
  });

  describe("updateTokenParams", () => {
    const newPricePerOneToken = wei(75);
    const newMinNFTFloorPrice = wei(60, priceDecimals);
    const newVoucherTokensAmount = wei(5);
    const newIsNFTBuyable = true;
    const newIsDisabled = true;
    const newIsVoucherBuyable = true;
    const newVoucherTokenContract = ZERO_ADDR;
    const newFundsRecipient = ZERO_ADDR;

    let tokenContract;

    beforeEach("setup", async () => {
      await marketplace.addToken("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        false,
        false,
        false,
      ]);

      tokenContract = await ERC721MintableToken.at((await marketplace.getTokenContractsPart(0, 10))[0]);
    });

    it("should correctly update all params", async () => {
      const voucher = await Voucher.new();

      const tx = await marketplace.updateTokenParams(tokenContract.address, [
        newPricePerOneToken,
        newMinNFTFloorPrice,
        newVoucherTokensAmount,
        voucher.address,
        newFundsRecipient,
        newIsNFTBuyable,
        newIsDisabled,
        newIsVoucherBuyable,
      ]);

      const tokenParams = (await marketplace.getDetailedTokenInfo([tokenContract.address]))[0];

      assert.equal(tokenParams.tokenParams.pricePerOneToken, newPricePerOneToken);
      assert.equal(tokenParams.tokenParams.minNFTFloorPrice, newMinNFTFloorPrice);
      assert.equal(tokenParams.tokenParams.voucherTokensAmount, newVoucherTokensAmount);
      assert.equal(tokenParams.tokenParams.isNFTBuyable, newIsNFTBuyable);
      assert.equal(tokenParams.tokenParams.voucherTokenContract, voucher.address);
      assert.equal(tokenParams.tokenParams.fundsRecipient, newFundsRecipient);
      assert.equal(tokenParams.tokenParams.isDisabled, newIsDisabled);
      assert.equal(tokenParams.tokenParams.isVoucherBuyable, newIsVoucherBuyable);

      assert.equal(tx.receipt.logs[0].event, "TokenParamsUpdated");
      assert.equal(tx.receipt.logs[0].args.tokenContract, tokenContract.address);

      const newTokenParams = tx.receipt.logs[0].args.tokenParams;
      assert.equal(newTokenParams.pricePerOneToken, newPricePerOneToken);
      assert.equal(newTokenParams.minNFTFloorPrice, newMinNFTFloorPrice);
      assert.equal(newTokenParams.voucherTokensAmount, newVoucherTokensAmount);
      assert.equal(newTokenParams.isNFTBuyable, newIsNFTBuyable);
      assert.equal(newTokenParams.voucherTokenContract, voucher.address);
      assert.equal(newTokenParams.fundsRecipient, newFundsRecipient);
      assert.equal(newTokenParams.isDisabled, newIsDisabled);
      assert.equal(newTokenParams.isVoucherBuyable, newIsVoucherBuyable);
    });

    it("should revert if caller is not a Marketplace manager", async () => {
      await truffleAssert.reverts(
        marketplace.updateTokenParams(
          tokenContract.address,
          [
            newPricePerOneToken,
            newMinNFTFloorPrice,
            newVoucherTokensAmount,
            newVoucherTokenContract,
            newFundsRecipient,
            newIsNFTBuyable,
            newIsDisabled,
            newIsVoucherBuyable,
          ],
          { from: NOTHING }
        ),
        "Marketplace: Caller is not a marketplace manager."
      );
    });

    it("should revert if contract not exists", async () => {
      await truffleAssert.reverts(
        marketplace.updateTokenParams(ZERO_ADDR, [
          newPricePerOneToken,
          newMinNFTFloorPrice,
          newVoucherTokensAmount,
          newVoucherTokenContract,
          newFundsRecipient,
          newIsNFTBuyable,
          newIsDisabled,
          newIsVoucherBuyable,
        ]),
        "Marketplace: Token contract not found."
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

      await marketplace.addToken("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        true,
        false,
        false,
      ]);

      tokenContract = await ERC721MintableToken.at((await marketplace.getTokenContractsPart(0, 10))[0]);
    });

    it("should pause and unpause token minting", async () => {
      const reason = "Pausable: paused";

      await marketplace.pause();

      const sig = signBuyTest({ tokenContract: tokenContract.address });

      await truffleAssert.reverts(
        marketplace.buyTokenWithERC20(
          [
            tokenContract.address,
            USER1,
            [paymentToken.address, tokenPrice, defaultDiscountValue, 0],
            [0, defaultTokenURI],
          ],
          [defaultEndTime, sig.r, sig.s, sig.v],
          {
            from: USER1,
          }
        ),
        reason
      );

      const newTokenURI = "new token URI";
      const sigNft = signBuyTest({
        tokenContract: tokenContract.address,
        futureTokenId: 1,
        paymentTokenAddress: nft.address,
        paymentTokenPrice: nftFloorPrice.toFixed(),
        tokenURI: newTokenURI,
      });

      await truffleAssert.reverts(
        marketplace.buyTokenWithNFT(
          [tokenContract.address, USER1, [nft.address, nftFloorPrice, defaultDiscountValue, tokenId], [0, newTokenURI]],
          [defaultEndTime, sigNft.r, sigNft.s, sigNft.v],
          { from: USER1 }
        ),
        reason
      );

      const sigETH = signBuyTest({
        tokenContract: tokenContract.address,
        futureTokenId: 2,
        paymentTokenAddress: ZERO_ADDR,
        tokenURI: defaultTokenURI + "!",
      });
      const expectedValueAmount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);
      await truffleAssert.reverts(
        marketplace.buyTokenWithETH(
          [tokenContract.address, USER1, [ZERO_ADDR, tokenPrice, defaultDiscountValue, 0], [0, defaultTokenURI]],
          [defaultEndTime, sigETH.r, sigETH.s, sigETH.v],
          {
            from: USER1,
            value: expectedValueAmount,
          }
        ),
        reason
      );

      await marketplace.unpause();

      await marketplace.buyTokenWithERC20(
        [
          tokenContract.address,
          USER1,
          [paymentToken.address, tokenPrice, defaultDiscountValue, 0],
          [0, defaultTokenURI],
        ],
        [defaultEndTime, sig.r, sig.s, sig.v],
        {
          from: USER1,
        }
      );

      await marketplace.buyTokenWithNFT(
        [tokenContract.address, USER1, [nft.address, nftFloorPrice, defaultDiscountValue, tokenId], [1, newTokenURI]],
        [defaultEndTime, sigNft.r, sigNft.s, sigNft.v],
        { from: USER1 }
      );

      await marketplace.buyTokenWithETH(
        [tokenContract.address, USER1, [ZERO_ADDR, tokenPrice, defaultDiscountValue, 0], [2, defaultTokenURI + "!"]],
        [defaultEndTime, sigETH.r, sigETH.s, sigETH.v],
        {
          from: USER1,
          value: expectedValueAmount,
        }
      );

      const token = await ERC721MintableToken.at(tokenContract.address);

      assert.equal(await token.tokenURI(0), defaultBaseURI + defaultTokenURI);
      assert.equal(await token.tokenURI(1), defaultBaseURI + newTokenURI);
      assert.equal(await token.tokenURI(2), defaultBaseURI + defaultTokenURI + "!");

      assert.equal(await token.ownerOf(0), USER1);
      assert.equal(await token.ownerOf(1), USER1);
      assert.equal(await token.ownerOf(2), USER1);
    });

    it("should pause and unpause token buying", async () => {
      const reason = "Pausable: paused";

      await marketplace.pause();
    });

    it("should get exception if non admin try to call this function", async () => {
      const reason = "Marketplace: Caller is not a marketplace manager.";

      await truffleAssert.reverts(marketplace.pause({ from: USER1 }), reason);
      await truffleAssert.reverts(marketplace.unpause({ from: USER1 }), reason);
    });
  });

  describe("withdrawCurrency", () => {
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
          tokenContract.address,
          USER1,
          [paymentToken.address, tokenPrice, defaultDiscountValue, 0],
          [0, defaultTokenURI],
        ],
        [defaultEndTime, sig.r, sig.s, sig.v],
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
          tokenContract.address,
          USER1,
          [paymentToken.address, tokenPrice, defaultDiscountValue, 0],
          [0, defaultTokenURI],
        ],
        [defaultEndTime, sig.r, sig.s, sig.v],
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
        [tokenContract.address, USER1, [ZERO_ADDR, tokenPrice, defaultDiscountValue, 0], [0, defaultTokenURI]],
        [defaultEndTime, sig.r, sig.s, sig.v],
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
        [tokenContract.address, USER1, [ZERO_ADDR, tokenPrice, defaultDiscountValue, 0], [0, defaultTokenURI]],
        [defaultEndTime, sig.r, sig.s, sig.v],
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
        [tokenContract.address, USER1, [ZERO_ADDR, tokenPrice, defaultDiscountValue, 0], [0, defaultTokenURI]],
        [defaultEndTime, sig.r, sig.s, sig.v],
        {
          from: USER1,
          value: expectedCurrencyAmount,
        }
      );

      await truffleAssert.reverts(marketplace.withdrawCurrency(ZERO_ADDR, contractsRegistry.address, 0, true), reason);
    });
  });

  describe("withdrawNFTs", () => {
    const tokenId = 13;
    const tokenId2 = 14;
    const nftFloorPrice = wei(90, priceDecimals);

    let tokenContract;

    beforeEach("setup", async () => {
      await nft.mint(USER1, tokenId);
      await nft.approve(marketplace.address, tokenId, { from: USER1 });

      await nft.mint(USER1, tokenId2);
      await nft.approve(marketplace.address, tokenId2, { from: USER1 });

      await nft2.mint(USER1, tokenId);
      await nft2.approve(marketplace.address, tokenId, { from: USER1 });

      await marketplace.addToken("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        true,
        false,
        true,
      ]);

      tokenContract = await ERC721MintableToken.at((await marketplace.getTokenContractsPart(0, 10))[0]);
    });

    it("should correctly withdraw NFT from the marketplace contract", async () => {
      const sig = signBuyTest({
        tokenContract: tokenContract.address,
        paymentTokenAddress: nft.address,
        paymentTokenPrice: nftFloorPrice.toFixed(),
      });

      await marketplace.buyTokenWithNFT(
        [
          tokenContract.address,
          USER1,
          [nft.address, nftFloorPrice, defaultDiscountValue, tokenId],
          [0, defaultTokenURI],
        ],
        [defaultEndTime, sig.r, sig.s, sig.v],
        {
          from: USER1,
        }
      );

      assert.equal(await tokenContract.ownerOf(0), USER1);
      assert.equal(await nft.ownerOf(tokenId), marketplace.address);

      const tx = await marketplace.withdrawNFTs(nft.address, OWNER, [tokenId]);

      assert.equal(await nft.ownerOf(tokenId), OWNER);

      assert.equal(tx.receipt.logs[0].event, "NFTTokensWithdrawn");
      assert.equal(tx.receipt.logs[0].args.nftAddr, nft.address);
      assert.equal(tx.receipt.logs[0].args.recipient, OWNER);
      assert.deepEqual(
        tx.receipt.logs[0].args.tokenIDs.map((el) => {
          return el.toNumber();
        }),
        [tokenId]
      );
    });

    it("should get exception if no a withdrawal manager calls this function", async () => {
      const reason = "Marketplace: Caller is not a withdrawal manager.";

      await truffleAssert.reverts(marketplace.withdrawNFTs(nft.address, OWNER, [tokenId], { from: NOTHING }), reason);
    });

    it("should get exception if desired nft is belong to pending request", async () => {
      const reason = "Marketplace: Can not withdraw NFT while it is in pending request.";

      await marketplace.createNFTRequest(tokenContract.address, nft.address, tokenId, { from: USER1 });
      const sig = signBuyWithRequestTest({});
      await marketplace.acceptRequest([1, USER1, [0, defaultTokenURI]], [defaultEndTime, sig.r, sig.s, sig.v], {
        from: USER1,
      });

      await marketplace.createNFTRequest(tokenContract.address, nft.address, tokenId2, { from: USER1 });
      await marketplace.createNFTRequest(tokenContract.address, nft2.address, tokenId, { from: USER1 });

      await truffleAssert.reverts(marketplace.withdrawNFTs(nft.address, OWNER, [tokenId, tokenId2]), reason);

      await marketplace.withdrawNFTs(nft.address, OWNER, [tokenId]);
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
        [tokenContract.address, USER1, [ZERO_ADDR, tokenPrice, defaultDiscountValue, 0], [0, defaultTokenURI]],
        [defaultEndTime, sig.r, sig.s, sig.v],
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

      assert.equal(toBN(log.args.mintedTokenPrice).toFixed(), defaultPricePerOneToken.toFixed());
      assert.equal(toBN(log.args.paidTokensAmount).toFixed(), expectedValueAmount.toFixed());
      assert.equal(toBN(log.args.paymentType).toFixed(), PaymentType.NATIVE);

      assert.equal(log.args.buyParams.recipient, USER1);
      assert.equal(log.args.buyParams.tokenContract, tokenContract.address);

      assert.equal(log.args.buyParams.paymentDetails.paymentTokenAddress, ZERO_ADDR);
      assert.equal(toBN(log.args.buyParams.paymentDetails.paymentTokenPrice).toFixed(), tokenPrice.toFixed());
      assert.equal(toBN(log.args.buyParams.paymentDetails.discount).toFixed(), defaultDiscountValue.toFixed());
      assert.equal(toBN(log.args.buyParams.paymentDetails.nftTokenId).toFixed(), 0);

      assert.equal(toBN(log.args.buyParams.tokenData.tokenId).toFixed(), 0);
      assert.equal(log.args.buyParams.tokenData.tokenURI, defaultTokenURI);
    });

    it("should correctly buy token with ETH and send currency to the funds recipient", async () => {
      await marketplace.updateTokenParams(tokenContract.address, [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        OWNER,
        true,
        false,
        false,
      ]);

      const sig = signBuyTest({ tokenContract: tokenContract.address, paymentTokenAddress: ZERO_ADDR });

      const expectedValueAmount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);
      const balanceBefore = await web3.eth.getBalance(OWNER);

      await marketplace.buyTokenWithETH(
        [tokenContract.address, USER1, [ZERO_ADDR, tokenPrice, defaultDiscountValue, 0], [0, defaultTokenURI]],
        [defaultEndTime, sig.r, sig.s, sig.v],
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
          [ZERO_ADDR, USER1, [ZERO_ADDR, 0, defaultDiscountValue, 0], [0, defaultTokenURI]],
          [defaultEndTime, sig.r, sig.s, sig.v],
          {
            from: USER1,
          }
        ),
        reason
      );
    });

    it("should get exception if token contract disabled", async () => {
      const reason = "Marketplace: Token is disabled.";

      await marketplace.updateTokenParams(tokenContract.address, [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        true,
        true,
        false,
      ]);

      const sig = signBuyTest({
        tokenContract: tokenContract.address,
        paymentTokenAddress: ZERO_ADDR,
        paymentTokenPrice: "0",
      });

      await truffleAssert.reverts(
        marketplace.buyTokenWithETH(
          [tokenContract.address, USER1, [tokenContract.address, 0, defaultDiscountValue, 0], [0, defaultTokenURI]],
          [defaultEndTime, sig.r, sig.s, sig.v],
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
          [tokenContract.address, USER1, [tokenContract.address, 0, defaultDiscountValue, 0], [0, defaultTokenURI]],
          [defaultEndTime, sig.r, sig.s, sig.v],
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
          [tokenContract.address, USER1, [ZERO_ADDR, 0, defaultDiscountValue, 0], [0, defaultTokenURI]],
          [defaultEndTime, sig.r, sig.s, sig.v],
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
          [tokenContract.address, USER1, [paymentToken.address, 0, defaultDiscountValue, 0], [0, defaultTokenURI]],
          [defaultEndTime, sig.r, sig.s, sig.v],
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
          [tokenContract.address, USER1, [ZERO_ADDR, tokenPrice, defaultDiscountValue, 0], [0, defaultTokenURI]],
          [defaultEndTime, sig.r, sig.s, sig.v],
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
        false,
      ]);

      tokenContract = await ERC721MintableToken.at((await marketplace.getTokenContractsPart(0, 10))[0]);
    });

    it("should correctly buy token with ERC20", async () => {
      const sig = signBuyTest({ tokenRecipient: USER2, tokenContract: tokenContract.address });

      const expectedTokensAmount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);

      const tx = await marketplace.buyTokenWithERC20(
        [
          tokenContract.address,
          USER2,
          [paymentToken.address, tokenPrice, defaultDiscountValue, 0],
          [0, defaultTokenURI],
        ],
        [defaultEndTime, sig.r, sig.s, sig.v],
        {
          from: USER1,
        }
      );

      assert.equal(await tokenContract.ownerOf(0), USER2);
      assert.equal(
        (await paymentToken.balanceOf(USER1)).toFixed(),
        mintTokensAmount.minus(expectedTokensAmount).toFixed()
      );

      const log = tx.receipt.logs[0];

      assert.equal(log.event, "TokenSuccessfullyPurchased");

      assert.equal(toBN(log.args.mintedTokenPrice).toFixed(), defaultPricePerOneToken.toFixed());
      assert.equal(toBN(log.args.paidTokensAmount).toFixed(), expectedTokensAmount.toFixed());
      assert.equal(toBN(log.args.paymentType).toFixed(), PaymentType.ERC20);

      assert.equal(log.args.buyParams.recipient, USER2);
      assert.equal(log.args.buyParams.tokenContract, tokenContract.address);

      assert.equal(log.args.buyParams.paymentDetails.paymentTokenAddress, paymentToken.address);
      assert.equal(toBN(log.args.buyParams.paymentDetails.paymentTokenPrice).toFixed(), tokenPrice.toFixed());
      assert.equal(toBN(log.args.buyParams.paymentDetails.discount).toFixed(), defaultDiscountValue.toFixed());
      assert.equal(toBN(log.args.buyParams.paymentDetails.nftTokenId).toFixed(), 0);

      assert.equal(toBN(log.args.buyParams.tokenData.tokenId).toFixed(), 0);
      assert.equal(log.args.buyParams.tokenData.tokenURI, defaultTokenURI);
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
        [tokenContract.address, USER1, [paymentToken.address, tokenPrice, discount, 0], [0, defaultTokenURI]],
        [defaultEndTime, sig.r, sig.s, sig.v],
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

      assert.equal(log.args.buyParams.recipient, USER1);
      assert.equal(toBN(log.args.paidTokensAmount).toFixed(), expectedTokensAmount.toFixed());
      assert.equal(toBN(log.args.paymentType).toFixed(), PaymentType.ERC20);
    });
  });

  describe("buyTokenWithVoucher", () => {
    let tokenContract;
    let voucherContract;

    beforeEach("setup", async () => {
      await marketplace.addToken("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        ZERO_ADDR,
        ZERO_ADDR,
        true,
        false,
        true,
      ]);

      tokenContract = await ERC721MintableToken.at((await marketplace.getTokenContractsPart(0, 10))[0]);
      voucherContract = await Voucher.at(
        (
          await marketplace.getDetailedTokenInfoPart(0, 10)
        )[0].tokenParams.voucherTokenContract
      );

      await voucherContract.mint(USER1, mintTokensAmount, { from: OWNER });
    });

    it("should correctly buy token with voucher", async () => {
      const sig = signBuyTest({
        tokenContract: tokenContract.address,
        paymentTokenAddress: voucherContract.address,
        paymentTokenPrice: "0",
      });

      const permitSig = signPermitTest({ verifyingContract: voucherContract.address });

      const tx = await marketplace.buyTokenWithVoucher(
        [tokenContract.address, USER1, [voucherContract.address, 0, defaultDiscountValue, 0], [0, defaultTokenURI]],
        [defaultEndTime, sig.r, sig.s, sig.v],
        [defaultEndTime, permitSig.r, permitSig.s, permitSig.v],
        {
          from: USER1,
        }
      );

      assert.equal(await tokenContract.ownerOf(0), USER1);
      assert.equal(
        (await voucherContract.balanceOf(USER1)).toFixed(),
        mintTokensAmount.minus(defaultVoucherTokensAmount).toFixed()
      );

      const log = tx.receipt.logs[0];

      assert.equal(log.event, "TokenSuccessfullyPurchased");

      assert.equal(toBN(log.args.mintedTokenPrice).toFixed(), defaultPricePerOneToken.toFixed());
      assert.equal(toBN(log.args.paidTokensAmount).toFixed(), defaultVoucherTokensAmount.toFixed());
      assert.equal(toBN(log.args.paymentType).toFixed(), PaymentType.VOUCHER);

      assert.equal(log.args.buyParams.recipient, USER1);
      assert.equal(log.args.buyParams.tokenContract, tokenContract.address);

      assert.equal(log.args.buyParams.paymentDetails.paymentTokenAddress, voucherContract.address);
      assert.equal(toBN(log.args.buyParams.paymentDetails.paymentTokenPrice).toFixed(), 0);
      assert.equal(toBN(log.args.buyParams.paymentDetails.discount).toFixed(), defaultDiscountValue.toFixed());
      assert.equal(toBN(log.args.buyParams.paymentDetails.nftTokenId).toFixed(), 0);

      assert.equal(toBN(log.args.buyParams.tokenData.tokenId).toFixed(), 0);
      assert.equal(log.args.buyParams.tokenData.tokenURI, defaultTokenURI);
    });

    it("should get exception if voucher token does not set", async () => {
      const reason = "Marketplace: Unable to buy token with voucher";

      await marketplace.updateTokenParams(tokenContract.address, [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        0,
        ZERO_ADDR,
        ZERO_ADDR,
        true,
        false,
        false,
      ]);

      const sig = signBuyTest({
        tokenContract: tokenContract.address,
        paymentTokenAddress: defaultVoucherContract.address,
      });

      const permitSig = signPermitTest({ verifyingContract: defaultVoucherContract.address });

      await truffleAssert.reverts(
        marketplace.buyTokenWithVoucher(
          [
            tokenContract.address,
            USER1,
            [defaultVoucherContract.address, tokenPrice, defaultDiscountValue, 0],
            [0, defaultTokenURI],
          ],
          [defaultEndTime, sig.r, sig.s, sig.v],
          [defaultEndTime, permitSig.r, permitSig.s, permitSig.v],
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
      const permitSig = signPermitTest({ verifyingContract: tokenContract.address });

      await truffleAssert.reverts(
        marketplace.buyTokenWithVoucher(
          [
            tokenContract.address,
            USER1,
            [tokenContract.address, tokenPrice, defaultDiscountValue, 0],
            [0, defaultTokenURI],
          ],
          [defaultEndTime, sig.r, sig.s, sig.v],
          [defaultEndTime, permitSig.r, permitSig.s, permitSig.v],
          {
            from: USER1,
          }
        ),
        reason
      );
    });

    it("should get exception if contract is paused", async () => {
      await marketplace.pause();

      const reason = "Pausable: paused";

      const sig = signBuyTest({
        tokenContract: tokenContract.address,
        paymentTokenAddress: voucherContract.address,
        paymentTokenPrice: "0",
      });

      const permitSig = signPermitTest({ verifyingContract: voucherContract.address });

      await truffleAssert.reverts(
        marketplace.buyTokenWithVoucher(
          [tokenContract.address, USER1, [voucherContract.address, 0, defaultDiscountValue, 0], [0, defaultTokenURI]],
          [defaultEndTime, sig.r, sig.s, sig.v],
          [defaultEndTime, permitSig.r, permitSig.s, permitSig.v],
          {
            from: USER1,
          }
        ),
        reason
      );

      await marketplace.unpause();

      await marketplace.buyTokenWithVoucher(
        [tokenContract.address, USER1, [voucherContract.address, 0, defaultDiscountValue, 0], [0, defaultTokenURI]],
        [defaultEndTime, sig.r, sig.s, sig.v],
        [defaultEndTime, permitSig.r, permitSig.s, permitSig.v],
        {
          from: USER1,
        }
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
        false,
      ]);

      tokenContract = await ERC721MintableToken.at((await marketplace.getTokenContractsPart(0, 10))[0]);
    });

    it("should correctly buy token with NFT", async () => {
      const sig = signBuyTest({
        tokenRecipient: USER2,
        tokenContract: tokenContract.address,
        paymentTokenAddress: nft.address,
        paymentTokenPrice: nftFloorPrice.toFixed(),
      });

      const tx = await marketplace.buyTokenWithNFT(
        [
          tokenContract.address,
          USER2,
          [nft.address, nftFloorPrice, defaultDiscountValue, tokenId],
          [0, defaultTokenURI],
        ],
        [defaultEndTime, sig.r, sig.s, sig.v],
        {
          from: USER1,
        }
      );

      assert.equal(await tokenContract.ownerOf(0), USER2);
      assert.equal(await nft.ownerOf(tokenId), marketplace.address);

      const log = tx.receipt.logs[0];

      assert.equal(log.event, "TokenSuccessfullyPurchased");

      assert.equal(toBN(log.args.mintedTokenPrice).toFixed(), defaultMinNFTFloorPrice.toFixed());
      assert.equal(toBN(log.args.paidTokensAmount).toFixed(), 1);
      assert.equal(toBN(log.args.paymentType).toFixed(), PaymentType.NFT);

      assert.equal(log.args.buyParams.recipient, USER2);
      assert.equal(log.args.buyParams.tokenContract, tokenContract.address);

      assert.equal(log.args.buyParams.paymentDetails.paymentTokenAddress, nft.address);
      assert.equal(toBN(log.args.buyParams.paymentDetails.paymentTokenPrice).toFixed(), nftFloorPrice.toFixed());
      assert.equal(toBN(log.args.buyParams.paymentDetails.discount).toFixed(), defaultDiscountValue.toFixed());
      assert.equal(toBN(log.args.buyParams.paymentDetails.nftTokenId).toFixed(), tokenId);

      assert.equal(toBN(log.args.buyParams.tokenData.tokenId).toFixed(), 0);
      assert.equal(log.args.buyParams.tokenData.tokenURI, defaultTokenURI);
    });

    it("should get exception if nft buy option is disabled", async () => {
      await marketplace.updateTokenParams(tokenContract.address, [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        false,
        false,
        false,
      ]);

      const reason = "Marketplace: This token cannot be purchased with NFT.";

      const sig = signBuyTest({
        tokenContract: tokenContract.address,
        paymentTokenAddress: nft.address,
        paymentTokenPrice: nftFloorPrice.toFixed(),
      });

      await truffleAssert.reverts(
        marketplace.buyTokenWithNFT(
          [
            tokenContract.address,
            USER1,
            [nft.address, nftFloorPrice, defaultDiscountValue, tokenId],
            [0, defaultTokenURI],
          ],
          [defaultEndTime, sig.r, sig.s, sig.v],
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
            tokenContract.address,
            USER1,
            [nft.address, newNFTFloorPrice, defaultDiscountValue, tokenId],
            [0, defaultTokenURI],
          ],
          [defaultEndTime, sig.r, sig.s, sig.v],
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
            tokenContract.address,
            USER1,
            [nft.address, nftFloorPrice, defaultDiscountValue, tokenId],
            [0, defaultTokenURI],
          ],
          [defaultEndTime, sig.r, sig.s, sig.v],
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

  describe("createNFTRequest", () => {
    const tokenId = 13;
    let tokenContract;
    let requestId;

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
        false,
      ]);

      tokenContract = await ERC721MintableToken.at((await marketplace.getTokenContractsPart(0, 10))[0]);
      requestId = await marketplace.nextRequestId();
    });

    it("should create NFT request", async () => {
      const tx = await marketplace.createNFTRequest(tokenContract.address, nft.address, tokenId, { from: USER1 });

      assert.equal(await nft.ownerOf(tokenId), marketplace.address);

      assert.equal(tx.logs.length, 1);
      assert.equal(tx.logs[0].event, "NFTRequestCreated");
      assert.equal(tx.logs[0].args.requestId.toString(), requestId.toString());
      assert.equal(tx.logs[0].args.requester, USER1);
      assert.equal(tx.logs[0].args.tokenContract, tokenContract.address);
      assert.equal(tx.logs[0].args.nftContract, nft.address);
      assert.equal(tx.logs[0].args.nftId, tokenId);
    });

    it("should revert if desired token is not exists", async () => {
      await truffleAssert.reverts(
        marketplace.createNFTRequest(ZERO_ADDR, nft.address, tokenId),
        "Marketplace: Token contract not found."
      );
    });

    it("should revert if desired token is disabled", async () => {
      await marketplace.updateTokenParams(tokenContract.address, [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        true,
        true,
        false,
      ]);

      await truffleAssert.reverts(
        marketplace.createNFTRequest(tokenContract.address, nft.address, tokenId),
        "Marketplace: Token is disabled."
      );
    });

    it("should revert if desired token is not allowed for NFT", async () => {
      await marketplace.updateTokenParams(tokenContract.address, [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        false,
        false,
        false,
      ]);

      await truffleAssert.reverts(
        marketplace.createNFTRequest(tokenContract.address, nft.address, tokenId),
        "Marketplace: This token cannot be purchased with NFT."
      );
    });

    it("should revert if sender is not owner of NFT", async () => {
      await truffleAssert.reverts(
        marketplace.createNFTRequest(tokenContract.address, nft.address, tokenId),
        "Marketplace: Sender is not the owner."
      );
    });

    it("should revert if marketplace is paused", async () => {
      const reason = "Pausable: paused";

      await marketplace.pause();

      await truffleAssert.reverts(
        marketplace.createNFTRequest(tokenContract.address, nft.address, tokenId, { from: USER1 }),
        reason
      );

      await marketplace.unpause();

      await marketplace.createNFTRequest(tokenContract.address, nft.address, tokenId, { from: USER1 });
    });
  });

  describe("cancelNFTRequest", () => {
    const tokenId = 13;

    let tokenContract;
    let requestId;

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
        false,
      ]);

      tokenContract = await ERC721MintableToken.at((await marketplace.getTokenContractsPart(0, 10))[0]);
      requestId = toBN(await marketplace.nextRequestId());

      await marketplace.createNFTRequest(tokenContract.address, nft.address, tokenId, { from: USER1 });
    });

    it("should cancel NFT request", async () => {
      const tx = await marketplace.cancelNFTRequest(requestId, { from: USER1 });

      assert.equal(await nft.ownerOf(tokenId), USER1);

      assert.equal(tx.logs.length, 1);
      assert.equal(tx.logs[0].event, "NFTRequestCanceled");
      assert.equal(tx.logs[0].args.requestId.toString(), requestId.toString());
    });

    it("should revert if sender is not requester", async () => {
      await truffleAssert.reverts(
        marketplace.cancelNFTRequest(requestId, { from: NOTHING }),
        "Marketplace: Sender is not the requester."
      );
    });

    it("should revert if status of request is not valid", async () => {
      const sig = signBuyWithRequestTest({});

      await marketplace.acceptRequest([requestId, USER1, [0, defaultTokenURI]], [defaultEndTime, sig.r, sig.s, sig.v], {
        from: USER1,
      });

      await truffleAssert.reverts(
        marketplace.cancelNFTRequest(requestId, { from: USER1 }),
        "Marketplace: Request status is not valid."
      );
    });
  });

  describe("acceptRequest", () => {
    const tokenId = 13;

    let tokenContract;
    let requestId;

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
        false,
      ]);

      tokenContract = await ERC721MintableToken.at((await marketplace.getTokenContractsPart(0, 10))[0]);
      requestId = toBN(await marketplace.nextRequestId());

      await marketplace.createNFTRequest(tokenContract.address, nft.address, tokenId, { from: USER1 });
    });

    it("should buy token with NFT request", async () => {
      const sig = signBuyWithRequestTest({ tokenRecipient: USER2 });

      const tx = await marketplace.acceptRequest(
        [requestId, USER2, [0, defaultTokenURI]],
        [defaultEndTime, sig.r, sig.s, sig.v],
        { from: USER1 }
      );

      assert.equal(await nft.ownerOf(tokenId), marketplace.address);

      assert.equal(tx.logs.length, 1);
      assert.equal(tx.logs[0].event, "TokenSuccessfullyExchanged");
      assert.equal(tx.logs[0].args.acceptRequestParams.recipient, USER2);
      assert.equal(tx.logs[0].args.acceptRequestParams.requestId.toString(), requestId.toString());

      assert.equal(tx.logs[0].args.acceptRequestParams.tokenData.tokenId.toString(), 0);
      assert.equal(tx.logs[0].args.acceptRequestParams.tokenData.tokenURI, defaultTokenURI);

      assert.equal(tx.logs[0].args.nftRequestInfo.tokenContract, tokenContract.address);
      assert.equal(tx.logs[0].args.nftRequestInfo.nftContract, nft.address);
      assert.equal(tx.logs[0].args.nftRequestInfo.nftId, tokenId);
      assert.equal(tx.logs[0].args.nftRequestInfo.requester, USER1);
      assert.equal(tx.logs[0].args.nftRequestInfo.status, NFTRequestStatus.ACCEPTED);

      assert.equal(await tokenContract.tokenURI(0), defaultBaseURI + defaultTokenURI);
      assert.equal(await tokenContract.ownerOf(0), USER2);
    });

    it("should buy token with NFT request and send funds to recipient contract", async () => {
      const ERC721Holder_impl = await ERC721Holder.new();
      await marketplace.updateTokenParams(tokenContract.address, [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ERC721Holder_impl.address,
        true,
        false,
        false,
      ]);

      const sig = signBuyWithRequestTest({});

      const tx = await marketplace.acceptRequest(
        [requestId, USER1, [0, defaultTokenURI]],
        [defaultEndTime, sig.r, sig.s, sig.v],
        { from: USER1 }
      );

      assert.equal(await nft.ownerOf(tokenId), ERC721Holder_impl.address);

      assert.equal(tx.logs.length, 1);
      assert.equal(tx.logs[0].event, "TokenSuccessfullyExchanged");
      assert.equal(tx.logs[0].args.acceptRequestParams.recipient, USER1);
      assert.equal(tx.logs[0].args.acceptRequestParams.requestId.toString(), requestId.toString());

      assert.equal(tx.logs[0].args.acceptRequestParams.tokenData.tokenId.toString(), 0);
      assert.equal(tx.logs[0].args.acceptRequestParams.tokenData.tokenURI, defaultTokenURI);

      assert.equal(tx.logs[0].args.nftRequestInfo.tokenContract, tokenContract.address);
      assert.equal(tx.logs[0].args.nftRequestInfo.nftContract, nft.address);
      assert.equal(tx.logs[0].args.nftRequestInfo.nftId, tokenId);
      assert.equal(tx.logs[0].args.nftRequestInfo.requester, USER1);
      assert.equal(tx.logs[0].args.nftRequestInfo.status, NFTRequestStatus.ACCEPTED);

      assert.equal(await tokenContract.tokenURI(0), defaultBaseURI + defaultTokenURI);
      assert.equal(await tokenContract.ownerOf(0), USER1);
    });

    it("should buy token with NFT request and send funds to recipient", async () => {
      await marketplace.updateTokenParams(tokenContract.address, [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        NOTHING,
        true,
        false,
        false,
      ]);

      const sig = signBuyWithRequestTest({});

      const tx = await marketplace.acceptRequest(
        [requestId, USER1, [0, defaultTokenURI]],
        [defaultEndTime, sig.r, sig.s, sig.v],
        { from: USER1 }
      );

      assert.equal(await nft.ownerOf(tokenId), NOTHING);

      assert.equal(tx.logs.length, 1);
      assert.equal(tx.logs[0].event, "TokenSuccessfullyExchanged");
      assert.equal(tx.logs[0].args.acceptRequestParams.recipient, USER1);
      assert.equal(tx.logs[0].args.acceptRequestParams.requestId.toString(), requestId.toString());

      assert.equal(tx.logs[0].args.acceptRequestParams.tokenData.tokenId.toString(), 0);
      assert.equal(tx.logs[0].args.acceptRequestParams.tokenData.tokenURI, defaultTokenURI);

      assert.equal(tx.logs[0].args.nftRequestInfo.tokenContract, tokenContract.address);
      assert.equal(tx.logs[0].args.nftRequestInfo.nftContract, nft.address);
      assert.equal(tx.logs[0].args.nftRequestInfo.nftId, tokenId);
      assert.equal(tx.logs[0].args.nftRequestInfo.requester, USER1);
      assert.equal(tx.logs[0].args.nftRequestInfo.status, NFTRequestStatus.ACCEPTED);

      assert.equal(await tokenContract.tokenURI(0), defaultBaseURI + defaultTokenURI);
      assert.equal(await tokenContract.ownerOf(0), USER1);
    });

    it("should revert if signature is invalid", async () => {
      const sig = signBuyWithRequestTest({});

      await truffleAssert.reverts(
        marketplace.acceptRequest([requestId, USER1, [1, defaultTokenURI]], [defaultEndTime, sig.r, sig.s, sig.v], {
          from: USER1,
        }),
        "Marketplace: Invalid signature."
      );
    });

    it("should revert if signature has expired", async () => {
      const sig = signBuyWithRequestTest({});

      await setNextBlockTime(defaultEndTime.plus(100).toNumber());

      await truffleAssert.reverts(
        marketplace.acceptRequest([requestId, USER1, [0, defaultTokenURI]], [defaultEndTime, sig.r, sig.s, sig.v], {
          from: USER1,
        }),
        "Marketplace: Signature expired."
      );
    });

    it("should revert if requester is wrong", async () => {
      const sig = signBuyWithRequestTest({});

      await truffleAssert.reverts(
        marketplace.acceptRequest([requestId, USER1, [0, defaultTokenURI]], [defaultEndTime, sig.r, sig.s, sig.v], {
          from: NOTHING,
        }),
        "Marketplace: Sender is not the requester."
      );
    });

    it("should revert if token is disabled", async () => {
      await marketplace.updateTokenParams(tokenContract.address, [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        NOTHING,
        true,
        true,
        false,
      ]);

      const sig = signBuyWithRequestTest({});

      await truffleAssert.reverts(
        marketplace.acceptRequest([requestId, USER1, [0, defaultTokenURI]], [defaultEndTime, sig.r, sig.s, sig.v], {
          from: USER1,
        }),
        "Marketplace: Token is disabled."
      );
    });

    it("should revert if token is not NFT buyable", async () => {
      await marketplace.updateTokenParams(tokenContract.address, [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        NOTHING,
        false,
        false,
        false,
      ]);

      const sig = signBuyWithRequestTest({});

      await truffleAssert.reverts(
        marketplace.acceptRequest([requestId, USER1, [0, defaultTokenURI]], [defaultEndTime, sig.r, sig.s, sig.v], {
          from: USER1,
        }),
        "Marketplace: This token cannot be purchased with NFT."
      );
    });

    it("should revert if marketplace is paused", async () => {
      await marketplace.pause();

      const sig = signBuyWithRequestTest({ tokenRecipient: USER2 });

      await truffleAssert.reverts(
        marketplace.acceptRequest([requestId, USER2, [0, defaultTokenURI]], [defaultEndTime, sig.r, sig.s, sig.v], {
          from: USER1,
        }),
        "Pausable: paused"
      );

      await marketplace.unpause();

      await marketplace.acceptRequest([requestId, USER2, [0, defaultTokenURI]], [defaultEndTime, sig.r, sig.s, sig.v], {
        from: USER1,
      });
    });
  });
  describe("getTokenContractsPart", () => {
    it("should return correct token contracts arr", async () => {
      const addressesArr = [];

      for (let i = 0; i < 5; i++) {
        const tx = await marketplace.addToken("Test" + i, "TST" + i, [
          defaultPricePerOneToken,
          defaultMinNFTFloorPrice,
          defaultVoucherTokensAmount,
          defaultVoucherContract.address,
          ZERO_ADDR,
          false,
          false,
          false,
        ]);

        addressesArr.push(tx.receipt.logs[0].args.tokenContract);
      }

      assert.equal((await marketplace.getTokenContractsCount()).toString(), 5);

      assert.deepEqual(await marketplace.getTokenContractsPart(0, 10), addressesArr);
      assert.deepEqual(await marketplace.getTokenContractsPart(0, 3), addressesArr.slice(0, 3));
      assert.deepEqual(await marketplace.getTokenContractsPart(3, 10), addressesArr.slice(3));
    });
  });

  describe("getBriefTokenInfoPart", () => {
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
          false,
        ];

        const tx = await marketplace.addToken("Test" + i, "TST" + i, tokenParam);
        baseTokenParams.push([[tx.receipt.logs[0].args.tokenContract, "Test" + i, "TST" + i], i.toString(), false]);
      }

      assert.equal((await marketplace.getTokenContractsCount()).toString(), 5);

      assert.deepEqual(await marketplace.getBriefTokenInfoPart(0, 10), baseTokenParams);
      assert.deepEqual(await marketplace.getBriefTokenInfoPart(0, 3), baseTokenParams.slice(0, 3));
      assert.deepEqual(await marketplace.getBriefTokenInfoPart(3, 10), baseTokenParams.slice(3));
    });
  });

  describe("getDetailedTokenInfoPart", () => {
    it("should return correct detailed token info", async () => {
      const detailedTokenInfo = [];

      for (let i = 0; i < 5; i++) {
        const tx = await marketplace.addToken("Test" + i, "TST" + i, [
          i,
          defaultMinNFTFloorPrice,
          defaultVoucherTokensAmount,
          defaultVoucherContract.address,
          ZERO_ADDR,
          false,
          false,
          false,
        ]);

        detailedTokenInfo.push([
          [tx.receipt.logs[0].args.tokenContract, "Test" + i, "TST" + i],
          [
            i.toString(),
            defaultMinNFTFloorPrice.toString(),
            defaultVoucherTokensAmount.toString(),
            defaultVoucherContract.address,
            ZERO_ADDR,
            false,
            false,
            false,
          ],
        ]);
      }

      assert.equal((await marketplace.getTokenContractsCount()).toString(), 5);

      assert.deepEqual(await marketplace.getDetailedTokenInfoPart(0, 10), detailedTokenInfo);
      assert.deepEqual(await marketplace.getDetailedTokenInfoPart(0, 3), detailedTokenInfo.slice(0, 3));
      assert.deepEqual(await marketplace.getDetailedTokenInfoPart(3, 10), detailedTokenInfo.slice(3));
    });
  });

  describe("getActiveTokenContractsCount", () => {
    it("should return correct active token contracts count", async () => {
      for (let i = 0; i < 5; i++) {
        const tx = await marketplace.addToken("Test" + i, "TST" + i, [
          defaultPricePerOneToken,
          defaultMinNFTFloorPrice,
          defaultVoucherTokensAmount,
          defaultVoucherContract.address,
          ZERO_ADDR,
          false,
          false,
          false,
        ]);

        assert.equal((await marketplace.getTokenContractsCount()).toString(), i + 1);
        assert.equal((await marketplace.getActiveTokenContractsCount()).toString(), 1);

        await marketplace.updateTokenParams(tx.receipt.logs[0].args.tokenContract, [
          defaultPricePerOneToken,
          defaultMinNFTFloorPrice,
          defaultVoucherTokensAmount,
          defaultVoucherContract.address,
          ZERO_ADDR,
          false,
          true,
          false,
        ]);

        assert.equal((await marketplace.getActiveTokenContractsCount()).toString(), 0);
      }
    });
  });

  describe("getUserTokensPart", () => {
    let tokenContract;
    let tokenContract2;

    beforeEach(async () => {
      await marketplace.addToken("Test", "TST", [
        defaultPricePerOneToken,
        defaultMinNFTFloorPrice,
        defaultVoucherTokensAmount,
        defaultVoucherContract.address,
        ZERO_ADDR,
        false,
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
        false,
      ]);

      const tokenContracts = await marketplace.getTokenContractsPart(0, 10);

      tokenContract = await ERC721MintableToken.at(tokenContracts[0]);
      tokenContract2 = await ERC721MintableToken.at(tokenContracts[1]);
    });

    it("should return correct user tokens", async () => {
      const userTokens1 = [];

      for (let i = 0; i < 4; i++) {
        const sig = signBuyTest({
          tokenContract: tokenContract.address,
          futureTokenId: i,
          paymentTokenAddress: ZERO_ADDR,
          tokenURI: defaultTokenURI + i,
        });

        const expectedValueAmount = defaultPricePerOneToken.times(wei(1)).idiv(tokenPrice);

        await marketplace.buyTokenWithETH(
          [tokenContract.address, USER1, [ZERO_ADDR, tokenPrice, defaultDiscountValue, 0], [i, defaultTokenURI + i]],
          [defaultEndTime, sig.r, sig.s, sig.v],
          {
            from: USER1,
            value: expectedValueAmount,
          }
        );

        userTokens1.push(i.toString());
      }

      const userTokensInfo1 = [
        [tokenContract.address, userTokens1],
        [tokenContract2.address, []],
      ];
      const userTokensInfo2 = [
        [tokenContract.address, []],
        [tokenContract2.address, []],
      ];

      assert.deepEqual(await marketplace.getUserTokensPart(USER1, 0, 10), userTokensInfo1);
      assert.deepEqual(await marketplace.getUserTokensPart(USER1, 0, 3), userTokensInfo1.slice(0, 3));
      assert.deepEqual(await marketplace.getUserTokensPart(USER1, 3, 10), userTokensInfo1.slice(3));

      assert.deepEqual(await marketplace.getUserTokensPart(NOTHING, 0, 10), userTokensInfo2);
      assert.deepEqual(await marketplace.getUserTokensPart(NOTHING, 0, 3), userTokensInfo2.slice(0, 3));
      assert.deepEqual(await marketplace.getUserTokensPart(NOTHING, 3, 10), userTokensInfo2.slice(3));
    });
  });

  describe("getPendingRequestsPart", () => {
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
        true,
      ]);

      tokenContract = await ERC721MintableToken.at((await marketplace.getTokenContractsPart(0, 10))[0]);
    });

    it("should return correct pending request ids", async () => {
      const expectedRequestIDs = [];

      for (let i = 0; i < 5; i++) {
        await nft.mint(USER1, i);
        await nft.approve(marketplace.address, i, { from: USER1 });

        await marketplace.createNFTRequest(tokenContract.address, nft.address, i, { from: USER1 });

        expectedRequestIDs.push(i + 1);
      }

      assert.equal((await marketplace.getAllPendingRequestsCount()).toFixed(), 5);

      assert.deepEqual(
        (await marketplace.getPendingRequestsPart(0, 10)).map((el) => {
          return el.toNumber();
        }),
        expectedRequestIDs
      );
      assert.deepEqual(
        (await marketplace.getPendingRequestsPart(0, 3)).map((el) => {
          return el.toNumber();
        }),
        expectedRequestIDs.slice(0, 3)
      );
      assert.deepEqual(
        (await marketplace.getPendingRequestsPart(3, 10)).map((el) => {
          return el.toNumber();
        }),
        expectedRequestIDs.slice(3)
      );

      const sig = signBuyWithRequestTest({ requestId: 5 });

      await marketplace.acceptRequest([5, USER1, [0, defaultTokenURI]], [defaultEndTime, sig.r, sig.s, sig.v], {
        from: USER1,
      });

      expectedRequestIDs.pop();

      assert.equal((await marketplace.getAllPendingRequestsCount()).toFixed(), 4);
      assert.deepEqual(
        (await marketplace.getPendingRequestsPart(0, 10)).map((el) => {
          return el.toNumber();
        }),
        expectedRequestIDs
      );
    });
  });

  describe("getUserPendingRequestsPart", () => {
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
        true,
      ]);

      tokenContract = await ERC721MintableToken.at((await marketplace.getTokenContractsPart(0, 10))[0]);
    });

    it("should return correct pending request ids for users", async () => {
      const expectedUSER1RequestIDs = [];
      const expectedOWNERRequestIDs = [];

      for (let i = 0; i < 5; i++) {
        await nft.mintBatch([USER1, OWNER], [i, i + 10]);

        await nft.approve(marketplace.address, i, { from: USER1 });
        await nft.approve(marketplace.address, i + 10, { from: OWNER });

        await marketplace.createNFTRequest(tokenContract.address, nft.address, i, { from: USER1 });
        await marketplace.createNFTRequest(tokenContract.address, nft.address, i + 10, { from: OWNER });

        expectedUSER1RequestIDs.push(i * 2 + 1);
        expectedOWNERRequestIDs.push(i * 2 + 2);
      }

      assert.equal((await marketplace.getUserPendingRequestsCount(USER1)).toFixed(), 5);
      assert.equal((await marketplace.getUserPendingRequestsCount(OWNER)).toFixed(), 5);

      assert.deepEqual(
        (await marketplace.getUserPendingRequestsPart(USER1, 0, 10)).map((el) => {
          return el.toNumber();
        }),
        expectedUSER1RequestIDs
      );
      assert.deepEqual(
        (await marketplace.getUserPendingRequestsPart(USER1, 0, 3)).map((el) => {
          return el.toNumber();
        }),
        expectedUSER1RequestIDs.slice(0, 3)
      );
      assert.deepEqual(
        (await marketplace.getUserPendingRequestsPart(USER1, 3, 10)).map((el) => {
          return el.toNumber();
        }),
        expectedUSER1RequestIDs.slice(3)
      );

      assert.deepEqual(
        (await marketplace.getUserPendingRequestsPart(OWNER, 0, 10)).map((el) => {
          return el.toNumber();
        }),
        expectedOWNERRequestIDs
      );

      const sig = signBuyWithRequestTest({});

      await marketplace.acceptRequest([1, USER1, [0, defaultTokenURI]], [defaultEndTime, sig.r, sig.s, sig.v], {
        from: USER1,
      });

      assert.equal((await marketplace.getUserPendingRequestsCount(USER1)).toFixed(), 4);

      expectedUSER1RequestIDs[0] = expectedUSER1RequestIDs[expectedUSER1RequestIDs.length - 1];
      expectedUSER1RequestIDs.pop();

      assert.deepEqual(
        (await marketplace.getUserPendingRequestsPart(USER1, 0, 10)).map((el) => {
          return el.toNumber();
        }),
        expectedUSER1RequestIDs
      );
    });
  });

  describe("getNFTRequestsInfo", () => {
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
        true,
      ]);

      tokenContract = await ERC721MintableToken.at((await marketplace.getTokenContractsPart(0, 10))[0]);

      await marketplace.createNFTRequest(tokenContract.address, nft.address, tokenId, { from: USER1 });
    });

    it("should return correct pending request ids", async () => {
      const result = (await marketplace.getNFTRequestsInfo([1]))[0];

      assert.equal(result.requester, USER1);
      assert.equal(result.tokenContract, tokenContract.address);
      assert.equal(result.nftContract, nft.address);
      assert.equal(result.nftId.toString(), tokenId);
      assert.equal(result.status, NFTRequestStatus.PENDING);
    });
  });
});
