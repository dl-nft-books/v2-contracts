const { assert } = require("chai");
const { wei, accounts, toBN } = require("../../scripts/utils/utils");
const { ZERO_ADDR, PRECISION, PERCENTAGE_100 } = require("../../scripts/utils/constants");
const Reverter = require("../helpers/reverter");
const truffleAssert = require("truffle-assertions");
const { signPermit } = require("../helpers/signatures");

const ContractsRegistry = artifacts.require("ContractsRegistry");
const TokenRegistry = artifacts.require("TokenRegistry");
const RoleManager = artifacts.require("RoleManager");
const Voucher = artifacts.require("Voucher");

describe("Voucher", () => {
  let OWNER;
  let SECOND;
  let FACTORY;

  let voucher;
  let contractsRegistry;
  let tokenRegistry;
  let VOUCHER_POOL;

  const reverter = new Reverter();

  before("setup", async () => {
    OWNER = await accounts(0);
    SECOND = await accounts(1);
    FACTORY = await accounts(3);

    const _roleManager = await RoleManager.new();
    const _tokenRegistry = await TokenRegistry.new();
    contractsRegistry = await ContractsRegistry.new();

    await contractsRegistry.__OwnableContractsRegistry_init();

    await contractsRegistry.addProxyContract(await contractsRegistry.ROLE_MANAGER_NAME(), _roleManager.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.TOKEN_REGISTRY_NAME(), _tokenRegistry.address);
    await contractsRegistry.addContract(await contractsRegistry.TOKEN_FACTORY_NAME(), FACTORY);

    tokenRegistry = await TokenRegistry.at(await contractsRegistry.getTokenRegistryContract());
    await (await RoleManager.at(await contractsRegistry.getRoleManagerContract())).__RoleManager_init();

    await contractsRegistry.injectDependencies(await contractsRegistry.TOKEN_REGISTRY_NAME());

    voucher = await Voucher.new();
    await voucher.__Voucher_init("name", "symbol");

    VOUCHER_POOL = await tokenRegistry.VOUCHER_POOL();
    await tokenRegistry.addProxyPool(VOUCHER_POOL, voucher.address, {
      from: FACTORY,
    });
    await tokenRegistry.injectDependenciesToExistingPools(VOUCHER_POOL, 0, 10);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("initialization", () => {
    it("should set name", async () => {
      assert.equal(await voucher.name(), "name");
    });

    it("should set symbol", async () => {
      assert.equal(await voucher.symbol(), "symbol");
    });

    it("should get exception if contract already initialized", async () => {
      await truffleAssert.reverts(
        voucher.__Voucher_init("Test", "TST"),
        "Initializable: contract is already initialized"
      );
    });
  });

  describe("dependency injection", () => {
    it("should not allow random users to inject dependencies", async () => {
      await truffleAssert.reverts(
        voucher.setDependencies(contractsRegistry.address, "0x"),
        "Dependant: not an injector"
      );
    });
  });

  describe("mint()", () => {
    it("should mint correctly", async () => {
      await voucher.mint(SECOND, 1, { from: OWNER });
      assert.equal(await voucher.balanceOf(SECOND), 1);
    });

    it("should revert if not role manager", async () => {
      await truffleAssert.reverts(
        voucher.mint(SECOND, 1, { from: SECOND }),
        "Voucher: Caller is not an token manager."
      );
    });
  });

  describe("burn()", () => {
    it("should burn correctly", async () => {
      await voucher.mint(SECOND, 1, { from: OWNER });
      await voucher.burn(SECOND, 1, { from: OWNER });
      assert.equal(await voucher.balanceOf(SECOND), 0);
    });

    it("should revert if not role manager", async () => {
      await truffleAssert.reverts(
        voucher.burn(SECOND, 1, { from: SECOND }),
        "Voucher: Caller is not an token manager."
      );
    });
  });
});
