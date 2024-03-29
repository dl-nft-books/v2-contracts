const { assert } = require("chai");
const { accounts } = require("../scripts/utils/utils");
const { parseConfig } = require("../deploy/helpers/deployHelper");

const Reverter = require("./helpers/reverter");
const truffleAssert = require("truffle-assertions");

const ContractsRegistry = artifacts.require("ContractsRegistry");
const TokenFactory = artifacts.require("TokenFactory");
const TokenRegistry = artifacts.require("TokenRegistry");
const RoleManager = artifacts.require("RoleManager");
const ERC721MintableToken = artifacts.require("ERC721MintableToken");
const Voucher = artifacts.require("Voucher");

TokenRegistry.numberFormat = "BigNumber";

describe("TokenFactory", () => {
  let OWNER;
  let MARKETPLACE;
  let NOTHING;

  let tokenRegistry;
  let tokenFactory;

  const reverter = new Reverter();

  before("setup", async () => {
    OWNER = await accounts(0);
    MARKETPLACE = await accounts(1);
    NOTHING = await accounts(3);

    const contractsRegistry = await ContractsRegistry.new();
    const _tokenFactory = await TokenFactory.new();
    const _tokenRegistry = await TokenRegistry.new();
    const _roleManager = await RoleManager.new();

    await contractsRegistry.__OwnableContractsRegistry_init();

    await contractsRegistry.addProxyContract(await contractsRegistry.TOKEN_FACTORY_NAME(), _tokenFactory.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.TOKEN_REGISTRY_NAME(), _tokenRegistry.address);
    await contractsRegistry.addContract(await contractsRegistry.MARKETPLACE_NAME(), MARKETPLACE);
    await contractsRegistry.addProxyContract(await contractsRegistry.ROLE_MANAGER_NAME(), _roleManager.address);

    tokenRegistry = await TokenRegistry.at(await contractsRegistry.getTokenRegistryContract());
    tokenFactory = await TokenFactory.at(await contractsRegistry.getTokenFactoryContract());
    roleManager = await RoleManager.at(await contractsRegistry.getRoleManagerContract());

    const config = parseConfig("./test/data/config.test.json");
    await roleManager.__RoleManager_init(config.roleInitParams);

    await contractsRegistry.injectDependencies(await contractsRegistry.TOKEN_FACTORY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.TOKEN_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.ROLE_MANAGER_NAME());

    const tokenName = [await tokenRegistry.TOKEN_CONTRACT(), await tokenRegistry.VOUCHER_TOKEN()];

    const tokenAddr = [(await ERC721MintableToken.new()).address, (await Voucher.new()).address];

    await tokenRegistry.setNewImplementations(tokenName, tokenAddr);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("access", () => {
    it("only marketplace should call these methods", async () => {
      await truffleAssert.reverts(
        tokenFactory.deployToken("TestToken", "TT"),
        "TokenFactory: Caller is not a marketplace"
      );

      await truffleAssert.reverts(
        tokenFactory.deployVoucher("TestVoucher", "TV", { from: NOTHING }),
        "TokenFactory: Caller is not a marketplace"
      );
    });
  });

  describe("deployToken", () => {
    it("should deploy token", async () => {
      const tx = await tokenFactory.deployToken("TestToken", "TT", { from: MARKETPLACE });

      assert.equal((await tokenRegistry.countPools(await tokenRegistry.TOKEN_CONTRACT())).toFixed(), "1");

      const token = await ERC721MintableToken.at(
        (
          await tokenRegistry.listPools(await tokenRegistry.TOKEN_CONTRACT(), 0, 1)
        )[0]
      );

      assert.equal(tx.receipt.logs[0].event, "TokenDeployed");
      assert.equal(tx.receipt.logs[0].args.tokenProxyAddr, token.address);

      assert.equal(await token.name(), "TestToken");
    });
  });

  describe("deployVoucher", () => {
    it("should deploy voucher", async () => {
      const tx = await tokenFactory.deployVoucher("TestVoucher", "TV", { from: MARKETPLACE });

      assert.equal((await tokenRegistry.countPools(await tokenRegistry.VOUCHER_TOKEN())).toFixed(), "1");

      const token = await ERC721MintableToken.at(
        (
          await tokenRegistry.listPools(await tokenRegistry.VOUCHER_TOKEN(), 0, 1)
        )[0]
      );

      assert.equal(tx.receipt.logs[0].event, "TokenDeployed");
      assert.equal(tx.receipt.logs[0].args.tokenProxyAddr, token.address);

      assert.equal(await token.name(), "TestVoucher");
    });

    it("should deploy voucher with Token Factory manager role", async () => {
      const tx = await tokenFactory.deployVoucher("TestVoucher", "TV", { from: OWNER });

      assert.equal((await tokenRegistry.countPools(await tokenRegistry.VOUCHER_TOKEN())).toFixed(), "1");

      const token = await ERC721MintableToken.at(
        (
          await tokenRegistry.listPools(await tokenRegistry.VOUCHER_TOKEN(), 0, 1)
        )[0]
      );

      assert.equal(tx.receipt.logs[0].event, "TokenDeployed");
      assert.equal(tx.receipt.logs[0].args.tokenProxyAddr, token.address);

      assert.equal(await token.name(), "TestVoucher");
    });
  });
});
