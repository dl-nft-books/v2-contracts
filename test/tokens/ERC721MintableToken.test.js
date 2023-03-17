const { assert } = require("chai");
const { wei, accounts, toBN } = require("../../scripts/utils/utils");
const Reverter = require("../helpers/reverter");
const truffleAssert = require("truffle-assertions");

const ERC721MintableToken = artifacts.require("ERC721MintableToken");
const ContractsRegistry = artifacts.require("ContractsRegistry");
const RoleManager = artifacts.require("RoleManager");

describe("Marketplace", () => {
  let OWNER;
  let SECOND;
  let MARKETPLACE;
  let NOTHING;

  let token;

  const priceDecimals = toBN(18);

  const reverter = new Reverter();

  before("setup", async () => {
    OWNER = await accounts(0);
    SECOND = await accounts(1);
    MARKETPLACE = await accounts(2);
    NOTHING = await accounts(3);

    const _contractsRegistry = await ContractsRegistry.new();
    const _roleManager = await RoleManager.new();

    await _contractsRegistry.__OwnableContractsRegistry_init();

    await _contractsRegistry.addContract(await _contractsRegistry.MARKETPLACE_NAME(), MARKETPLACE);
    await _contractsRegistry.addProxyContract(await _contractsRegistry.ROLE_MANAGER_NAME(), _roleManager.address);

    await (await RoleManager.at(await _contractsRegistry.getRoleManagerContract())).__RoleManager_init();

    await _contractsRegistry.injectDependencies(await _contractsRegistry.ROLE_MANAGER_NAME());

    token = await ERC721MintableToken.new();
    await token.__ERC721MintableToken_init();

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("creation", () => {
    it("should set correct data after deployment", async () => {});
    it("should get exception if contract already initialized", async () => {
      await truffleAssert.reverts(token.__ERC721MintableToken_init(), "Initializable: contract is already initialized");
    });
  });

  describe("mint()", () => {
    it("should mint correctly", async () => {
      await token.mint(SECOND, 1, "uri", { from: MARKETPLACE });
      assert.equal(await token.ownerOf(1), MARKETPLACE);
    });
    it("should revert if not marketplace", async () => {
      await truffleAssert.reverts(token.mint(SECOND, 1, "uri"), "ERC721MintableToken: Caller is not a Marketplace");
    });
  });
});
