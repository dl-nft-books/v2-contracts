const { assert } = require("chai");
const { accounts } = require("../scripts/utils/utils");
const { parseConfig } = require("../deploy/helpers/deployHelper");

const Reverter = require("./helpers/reverter");
const truffleAssert = require("truffle-assertions");

const ContractsRegistry = artifacts.require("ContractsRegistry");
const TokenRegistry = artifacts.require("TokenRegistry");
const Marketplace = artifacts.require("Marketplace");
const RoleManager = artifacts.require("RoleManager");
const ERC721MintableToken = artifacts.require("ERC721MintableToken");
const Pool = artifacts.require("Pool");
const Voucher = artifacts.require("Voucher");

TokenRegistry.numberFormat = "BigNumber";

describe("TokenRegistry", () => {
  let OWNER;
  let FACTORY;

  let TOKEN_POOL;
  let VOUCHER_POOL;

  let pool;
  let token;
  let tokenRegistry;
  let contractsRegistry;

  const reverter = new Reverter();

  before("setup", async () => {
    OWNER = await accounts(0);
    FACTORY = await accounts(1);

    token = await ERC721MintableToken.new();
    pool = await Pool.new();
    voucher = await Voucher.new();

    contractsRegistry = await ContractsRegistry.new();
    const _tokenRegistry = await TokenRegistry.new();
    const _marketplace = await Marketplace.new();
    const _roleManager = await RoleManager.new();

    await contractsRegistry.__OwnableContractsRegistry_init();

    await contractsRegistry.addContract(await contractsRegistry.TOKEN_FACTORY_NAME(), FACTORY);
    await contractsRegistry.addContract(await contractsRegistry.TOKEN_REGISTRY_NAME(), _tokenRegistry.address);
    await contractsRegistry.addContract(await contractsRegistry.MARKETPLACE_NAME(), _marketplace.address);
    await contractsRegistry.addContract(await contractsRegistry.ROLE_MANAGER_NAME(), _roleManager.address);

    tokenRegistry = await TokenRegistry.at(await contractsRegistry.getTokenRegistryContract());
    roleManager = await RoleManager.at(await contractsRegistry.getRoleManagerContract());

    const config = parseConfig("./test/data/config.test.json");
    await roleManager.__RoleManager_init(config.roleInitParams);

    await contractsRegistry.injectDependencies(await contractsRegistry.TOKEN_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.MARKETPLACE_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.ROLE_MANAGER_NAME());

    TOKEN_POOL = await tokenRegistry.TOKEN_POOL();
    VOUCHER_POOL = await tokenRegistry.VOUCHER_POOL();

    const poolName = [TOKEN_POOL, VOUCHER_POOL];

    const poolAddr = [token.address, voucher.address];

    await tokenRegistry.setNewImplementations(poolName, poolAddr);

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
    it("only token registry manager should call these methods", async () => {
      await truffleAssert.reverts(
        tokenRegistry.setNewImplementations([TOKEN_POOL], [token.address], { from: FACTORY }),
        "TokenRegistry: Caller is not a token registry manager"
      );

      await truffleAssert.reverts(
        tokenRegistry.injectDependenciesToExistingPools(TOKEN_POOL, 0, 0, { from: FACTORY }),
        "TokenRegistry: Caller is not a token registry manager"
      );

      await truffleAssert.reverts(
        tokenRegistry.injectDependenciesToExistingPoolsWithData(TOKEN_POOL, 0, 0, 0, { from: FACTORY }),
        "TokenRegistry: Caller is not a token registry manager"
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
      assert.isFalse(await tokenRegistry.isTokenPool(POOL_3));

      await tokenRegistry.addProxyPool(TOKEN_POOL, POOL_1, { from: FACTORY });
      await tokenRegistry.addProxyPool(TOKEN_POOL, POOL_2, { from: FACTORY });

      assert.equal((await tokenRegistry.countPools(TOKEN_POOL)).toFixed(), "2");

      assert.isTrue(await tokenRegistry.isTokenPool(POOL_1));
      assert.isTrue(await tokenRegistry.isTokenPool(POOL_2));
      assert.isFalse(await tokenRegistry.isTokenPool(POOL_3));
    });

    it("should successfully add new VOUCHER POOL with", async () => {
      assert.isFalse(await tokenRegistry.isVoucherPool(POOL_1));
      assert.isFalse(await tokenRegistry.isVoucherPool(POOL_2));
      assert.isFalse(await tokenRegistry.isVoucherPool(POOL_3));

      await tokenRegistry.addProxyPool(VOUCHER_POOL, POOL_1, { from: FACTORY });
      await tokenRegistry.addProxyPool(VOUCHER_POOL, POOL_2, { from: FACTORY });

      assert.equal((await tokenRegistry.countPools(VOUCHER_POOL)).toFixed(), "2");

      assert.isTrue(await tokenRegistry.isVoucherPool(POOL_1));
      assert.isTrue(await tokenRegistry.isVoucherPool(POOL_2));
      assert.isFalse(await tokenRegistry.isVoucherPool(POOL_3));
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

  describe("inject dependencies", () => {
    it("should successfully inject dependencies", async () => {
      await tokenRegistry.addProxyPool(TOKEN_POOL, pool.address, { from: FACTORY });

      assert.equal(await pool.roleManager(), 0);

      await tokenRegistry.injectDependenciesToExistingPools(TOKEN_POOL, 0, 1);

      assert.equal(await pool.roleManager(), await contractsRegistry.getRoleManagerContract());
    });
  });

  it("should successfully inject dependencies with data", async () => {
    await tokenRegistry.addProxyPool(TOKEN_POOL, pool.address, { from: FACTORY });

    assert.equal(await pool.roleManager(), 0);

    await tokenRegistry.injectDependenciesToExistingPoolsWithData(TOKEN_POOL, "0x", 0, 1);

    assert.equal(await pool.roleManager(), await contractsRegistry.getRoleManagerContract());
  });
});
