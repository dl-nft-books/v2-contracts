const { assert } = require("chai");
const { toBN, accounts } = require("../scripts/utils/utils");
const Reverter = require("./helpers/reverter");
const truffleAssert = require("truffle-assertions");
const { PRECISION } = require("../scripts/utils/constants");

const ContractsRegistry = artifacts.require("ContractsRegistry");
const TokenRegistry = artifacts.require("TokenRegistry");
const TokenFactory = artifacts.require("TokenFactory");
const Marketplace = artifacts.require("Marketplace");
const RoleManager = artifacts.require("RoleManager");
const ERC20Mock = artifacts.require("ERC20Mock");
const ERC721MintableToken = artifacts.require("ERC721MintableToken");

TokenRegistry.numberFormat = "BigNumber";

describe("TokenRegistry", () => {
  let OWNER;
  let FACTORY;
  let NOTHING;

  let TOKEN_POOL;

  let token;
  let tokenRegistry;

  const reverter = new Reverter();

  before("setup", async () => {
    OWNER = await accounts(0);
    FACTORY = await accounts(1);
    NOTHING = await accounts(9);

    token = await ERC721MintableToken.new();

    const contractsRegistry = await ContractsRegistry.new();
    const _tokenFactory = await TokenFactory.new();
    const _tokenRegistry = await TokenRegistry.new();
    const _marketplace = await Marketplace.new();
    const _roleManager = await RoleManager.new();

    await contractsRegistry.__OwnableContractsRegistry_init();

    await contractsRegistry.addContract(await contractsRegistry.TOKEN_FACTORY_NAME(), FACTORY);
    await contractsRegistry.addContract(await contractsRegistry.TOKEN_REGISTRY_NAME(), _tokenRegistry.address);
    await contractsRegistry.addContract(await contractsRegistry.MARKETPLACE_NAME(), _marketplace.address);
    await contractsRegistry.addContract(await contractsRegistry.ROLE_MANAGER_NAME(), _roleManager.address);

    tokenRegistry = await TokenRegistry.at(await contractsRegistry.getTokenRegistryContract());
    // tokenFactory = await TokenFactory.at(await contractsRegistry.getTokenFactoryContract());

    // await contractsRegistry.injectDependencies(await contractsRegistry.TOKEN_FACTORY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.TOKEN_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.MARKETPLACE_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.ROLE_MANAGER_NAME());

    const poolName = [await tokenRegistry.TOKEN_POOL()];

    const poolAddr = [token.address];

    await tokenRegistry.setNewImplementations(poolName, poolAddr);

    TOKEN_POOL = await tokenRegistry.TOKEN_POOL();

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("access", () => {
    it("only factory should call these methods", async () => {
      await truffleAssert.reverts(
        tokenRegistry.addProxyPool(TOKEN_POOL, OWNER),
        "TokenRegistry: Caller is not a factory"
      );
    });
  });

  describe("add and list pools", () => {
    let POOL_1;
    let POOL_2;
    let POOL_3;

    beforeEach("setup", async () => {
      POOL_1 = await accounts(3);
      POOL_2 = await accounts(4);
      POOL_3 = await accounts(5);
    });

    it("should successfully add and get implementation", async () => {
      await tokenRegistry.setNewImplementations([TOKEN_POOL], [token.address]);

      assert.equal(await tokenRegistry.getImplementation(TOKEN_POOL), token.address);
    });

    it("should successfully add new TOKEN POOL", async () => {
      assert.isFalse(await tokenRegistry.isTokenPool(POOL_1));
      assert.isFalse(await tokenRegistry.isTokenPool(POOL_2));

      await tokenRegistry.addProxyPool(TOKEN_POOL, POOL_1, { from: FACTORY });
      await tokenRegistry.addProxyPool(TOKEN_POOL, POOL_2, { from: FACTORY });

      assert.equal((await tokenRegistry.countPools(TOKEN_POOL)).toFixed(), "2");

      assert.isTrue(await tokenRegistry.isTokenPool(POOL_2));
    });

    it("should list added pools", async () => {
      await tokenRegistry.addProxyPool(TOKEN_POOL, POOL_1, { from: FACTORY });
      await tokenRegistry.addProxyPool(TOKEN_POOL, POOL_2, { from: FACTORY });

      assert.deepEqual(await tokenRegistry.listPools(TOKEN_POOL, 0, 2), [POOL_1, POOL_2]);
      assert.deepEqual(await tokenRegistry.listPools(TOKEN_POOL, 0, 10), [POOL_1, POOL_2]);
      assert.deepEqual(await tokenRegistry.listPools(TOKEN_POOL, 1, 1), [POOL_2]);
      assert.deepEqual(await tokenRegistry.listPools(TOKEN_POOL, 2, 0), []);
    });
  });
});
