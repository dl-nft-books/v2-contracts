const { assert } = require("chai");
const { toBN, accounts, wei } = require("../scripts/utils/utils");
const Reverter = require("./helpers/reverter");
const truffleAssert = require("truffle-assertions");
const { ZERO_ADDR, PRECISION } = require("../scripts/utils/constants");
const { getCurrentBlockTime } = require("./helpers/block-helper");

const ContractsRegistry = artifacts.require("ContractsRegistry");
const TokenFactory = artifacts.require("TokenFactory");
const TokenRegistry = artifacts.require("TokenRegistry");
const RoleManager = artifacts.require("RoleManager");
const Marketplace = artifacts.require("Marketplace");
const ERC721MintableToken = artifacts.require("ERC721MintableToken");
const ERC20Mock = artifacts.require("ERC20Mock");

TokenRegistry.numberFormat = "BigNumber";

describe("PoolFactory", () => {
  let OWNER;
  let MARKETPLACE;
  let NOTHING;

  let tokenRegistry;
  let tokenFactory;

  let testERC20;

  const reverter = new Reverter();

  before("setup", async () => {
    OWNER = await accounts(0);
    MARKETPLACE = await accounts(1);
    NOTHING = await accounts(3);

    testERC20 = await ERC20Mock.new("TestERC20", "TS", 18);

    const contractsRegistry = await ContractsRegistry.new();
    const _tokenFactory = await TokenFactory.new();
    const _tokenRegistry = await TokenRegistry.new();
    const _marketplace = await Marketplace.new();
    const _roleManager = await RoleManager.new();

    await contractsRegistry.__OwnableContractsRegistry_init();
    await _roleManager.__RoleManager_init();

    await contractsRegistry.addProxyContract(await contractsRegistry.TOKEN_FACTORY_NAME(), _tokenFactory.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.TOKEN_REGISTRY_NAME(), _tokenRegistry.address);
    await contractsRegistry.addContract(await contractsRegistry.MARKETPLACE_NAME(), MARKETPLACE);
    await contractsRegistry.addProxyContract(await contractsRegistry.ROLE_MANAGER_NAME(), _roleManager.address);

    tokenRegistry = await TokenRegistry.at(await contractsRegistry.getTokenRegistryContract());
    tokenFactory = await TokenFactory.at(await contractsRegistry.getTokenFactoryContract());
    await (await RoleManager.at(await contractsRegistry.getRoleManagerContract())).__RoleManager_init();

    await contractsRegistry.injectDependencies(await contractsRegistry.TOKEN_FACTORY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.TOKEN_REGISTRY_NAME());
    // await contractsRegistry.injectDependencies(await contractsRegistry.MARKETPLACE_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.ROLE_MANAGER_NAME());

    const tokenName = [await tokenRegistry.TOKEN_POOL()];

    const tokenAddr = [(await ERC721MintableToken.new()).address];

    await tokenRegistry.setNewImplementations(tokenName, tokenAddr);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("deployToken", () => {
    it("should deploy token", async () => {
      let tx = await tokenFactory.deployToken("TestToken", "TT", { from: MARKETPLACE });
      let event = tx.receipt.logs[0];

      assert.isTrue(await tokenRegistry.isTokenPool(event.args.tokenProxy));
      assert.equal((await tokenRegistry.countPools(await tokenRegistry.TOKEN_POOL())).toFixed(), "1");

      let token = await ERC721MintableToken.at(
        (
          await tokenRegistry.listPools(await tokenRegistry.TOKEN_POOL(), 0, 1)
        )[0]
      );

      assert.equal(token.address, event.args.tokenProxy);
    });
  });
});
