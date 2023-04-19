const { assert } = require("chai");
const { accounts } = require("../../scripts/utils/utils");
const { parseConfig } = require("../../deploy/helpers/deployHelper");

const Reverter = require("../helpers/reverter");
const truffleAssert = require("truffle-assertions");

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
  let VOUCHER_TOKEN;

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

    const roleManager = await RoleManager.at(await contractsRegistry.getRoleManagerContract());
    tokenRegistry = await TokenRegistry.at(await contractsRegistry.getTokenRegistryContract());

    const config = parseConfig("./test/data/config.test.json");
    await roleManager.__RoleManager_init(config.roleInitParams);

    await contractsRegistry.injectDependencies(await contractsRegistry.TOKEN_REGISTRY_NAME());

    voucher = await Voucher.new();
    await voucher.__Voucher_init("name", "symbol");

    VOUCHER_TOKEN = await tokenRegistry.VOUCHER_TOKEN();

    await tokenRegistry.addProxyPool(VOUCHER_TOKEN, voucher.address, {
      from: FACTORY,
    });
    await tokenRegistry.injectDependenciesToExistingPools(VOUCHER_TOKEN, 0, 10);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("initialization", () => {
    it("should set correct metadata", async () => {
      assert.equal(await voucher.name(), "name");
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

  describe("mint", () => {
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

  describe("burn", () => {
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
