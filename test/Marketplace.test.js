const { assert } = require("chai");
const { wei, accounts, toBN } = require("../scripts/utils/utils");
const Reverter = require("./helpers/reverter");
const truffleAssert = require("truffle-assertions");

const ContractsRegistry = artifacts.require("ContractsRegistry");
const TokenFactory = artifacts.require("TokenFactory");
const TokenRegistry = artifacts.require("TokenRegistry");
const RoleManager = artifacts.require("RoleManager");
const ERC721MintableToken = artifacts.require("ERC721MintableToken");
const Marketplace = artifacts.require("Marketplace");

describe("Marketplace", () => {
  let OWNER;
  let MARKETPLACE;
  let NOTHING;

  let marketplace;
  let contractsRegistry;

  const priceDecimals = toBN(18);

  const reverter = new Reverter();

  before("setup", async () => {
    OWNER = await accounts(0);
    MARKETPLACE = await accounts(1);
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

    await marketplace.__Marketplace_init();

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("creation", () => {
    it("should set correct data after deployment", async () => {});

    it("should get exception if contract already initialized", async () => {
      await truffleAssert.reverts(marketplace.__Marketplace_init(), "Initializable: contract is already initialized");
    });
  });

  describe("updateTokenContractParams", () => {
    const newPrice = wei(75);
    const newMinNFTFloorPrice = wei(60, priceDecimals);
    const newName = "new name";
    const newSymbol = "NS";

    let tokenContract;

    // beforeEach(async () => {
    //   const tx = await marketplace.deployToken("Test", "TST", 1);
    //   // tokenContract = tx.logs[0].args.tokenProxy;
    //   console.log(tx);
    // });
    // it("should correctly update price per one token", async () => {
    //   const tx = await marketplace.updateTokenContractParams(
    //     tokenContract,
    //     newPrice,
    //     newMinNFTFloorPrice,
    //     newName,
    //     newSymbol
    //   );

    //   const tokenParams = await marketplace.tokenParams(tokenContract);
    //   assert.equal(tokenParams.pricePerOneToken.toFixed(), newPrice.toFixed());
    //   assert.equal(tokenParams.minNFTFloorPrice.toFixed(), newMinNFTFloorPrice.toFixed());
    //   assert.equal(tokenParams.name(), newName);
    //   assert.equal(tokenParams, newSymbol);

    //   await tokenContract.updateTokenContractParams(tokenContract, newPrice, newMinNFTFloorPrice, newName, newSymbol);

    //   assert.equal(tokenParams.pricePerOneToken.toFixed(), newPrice.toFixed());
    //   assert.equal(tokenParams.minNFTFloorPrice.toFixed(), newMinNFTFloorPrice.toFixed());
    //   assert.equal(tokenParams.name(), newName);
    //   assert.equal(tokenParams, newSymbol);

    //   assert.equal(tx.receipt.logs[0].event, "TokenContractParamsUpdated");
    //   assert.equal(tx.receipt.logs[0].args.tokenContract, tokenContract);
    //   assert.equal(toBN(tx.receipt.logs[0].args.newPrice).toFixed(), newPrice.toFixed());
    //   assert.equal(toBN(tx.receipt.logs[0].args.newMinNFTFloorPrice).toFixed(), newMinNFTFloorPrice.toFixed());
    //   assert.equal(tx.receipt.logs[0].args.tokenName, newName);
    //   assert.equal(tx.receipt.logs[0].args.tokenSymbol, newSymbol);
    // });

    // it("should correctly sign data with new contract name", async () => {
    //   await marketplace.updateTokenContractParams(tokenContract, newPrice, newMinNFTFloorPrice, newName, newSymbol);

    //   const paymentTokenPrice = wei(10000);
    //   const sig = signMintTest({ paymentTokenPrice: paymentTokenPrice.toFixed(), name: newName });

    //   const expectedPaymentAmount = newPrice.times(wei(1)).idiv(paymentTokenPrice);

    //   await tokenContract.mintToken(
    //     paymentToken.address,
    //     paymentTokenPrice,
    //     defaultDiscountValue,
    //     defaultEndTime,
    //     defaultTokenURI,
    //     sig.r,
    //     sig.s,
    //     sig.v,
    //     {
    //       from: USER1,
    //     }
    //   );

    //   assert.equal((await paymentToken.balanceOf(tokenContract.address)).toFixed(), expectedPaymentAmount.toFixed());
    // });

    // it("should get exception if sign with old name", async () => {
    //   await tokenContract.updateTokenContractParams(newPrice, newMinNFTFloorPrice, newName, newSymbol);

    //   const paymentTokenPrice = wei(10000);
    //   const sig = signMintTest({ paymentTokenPrice: paymentTokenPrice.toFixed() });

    //   const reason = "TokenContract: Invalid signature.";

    //   await truffleAssert.reverts(
    //     tokenContract.mintToken(
    //       paymentToken.address,
    //       paymentTokenPrice,
    //       defaultDiscountValue,
    //       defaultEndTime,
    //       defaultTokenURI,
    //       sig.r,
    //       sig.s,
    //       sig.v,
    //       {
    //         from: USER1,
    //       }
    //     ),
    //     reason
    //   );
    // });

    // it("should get exception if non admin try to call this function", async () => {
    //   await truffleAssert.reverts(
    //     marketplace.updateTokenContractParams(tokenContract, newPrice, newMinNFTFloorPrice, "", "", { from: NOTHING }),
    //     "TokenContract: Only admin can call this function."
    //   );
    // });
  });
});
