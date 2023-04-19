const { assert } = require("chai");
const { accounts } = require("../../scripts/utils/utils");
const { parseConfig } = require("../../deploy/helpers/deployHelper");

const Reverter = require("../helpers/reverter");
const truffleAssert = require("truffle-assertions");

const ERC721MintableToken = artifacts.require("ERC721MintableToken");
const ContractsRegistry = artifacts.require("ContractsRegistry");
const RoleManager = artifacts.require("RoleManager");
const TokenRegistry = artifacts.require("TokenRegistry");
const Marketplace = artifacts.require("Marketplace");

describe("ERC721MintableToken", () => {
  let OWNER;
  let SECOND;
  let MARKETPLACE;
  let FACTORY;
  let NOTHING;

  let token;
  let contractsRegistry;
  let tokenRegistry;
  let TOKEN_POOL;

  const reverter = new Reverter();

  before("setup", async () => {
    OWNER = await accounts(0);
    SECOND = await accounts(1);
    MARKETPLACE = await accounts(2);
    FACTORY = await accounts(3);
    NOTHING = await accounts(4);

    contractsRegistry = await ContractsRegistry.new();

    const _roleManager = await RoleManager.new();
    const _tokenRegistry = await TokenRegistry.new();

    await contractsRegistry.__OwnableContractsRegistry_init();

    await contractsRegistry.addContract(await contractsRegistry.MARKETPLACE_NAME(), MARKETPLACE);
    await contractsRegistry.addProxyContract(await contractsRegistry.ROLE_MANAGER_NAME(), _roleManager.address);
    await contractsRegistry.addContract(await contractsRegistry.TOKEN_FACTORY_NAME(), FACTORY);
    await contractsRegistry.addProxyContract(await contractsRegistry.TOKEN_REGISTRY_NAME(), _tokenRegistry.address);

    tokenRegistry = await TokenRegistry.at(await contractsRegistry.getTokenRegistryContract());
    roleManager = await RoleManager.at(await contractsRegistry.getRoleManagerContract());

    const config = parseConfig("./test/data/config.test.json");
    await roleManager.__RoleManager_init(config.roleInitParams);

    await contractsRegistry.injectDependencies(await contractsRegistry.ROLE_MANAGER_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.TOKEN_REGISTRY_NAME());

    token = await ERC721MintableToken.new();
    await token.__ERC721MintableToken_init("Test", "TST");

    TOKEN_POOL = await tokenRegistry.TOKEN_POOL();
    await tokenRegistry.addProxyPool(TOKEN_POOL, token.address, {
      from: FACTORY,
    });

    await tokenRegistry.injectDependenciesToExistingPools(0, 10);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("creation", () => {
    it("should set correct data after deployment", async () => {
      assert.equal(await token.name(), "Test");
      assert.equal(await token.symbol(), "TST");
    });

    it("should get exception if contract already initialized", async () => {
      await truffleAssert.reverts(
        token.__ERC721MintableToken_init("Test", "TST"),
        "Initializable: contract is already initialized"
      );
    });
  });

  describe("dependency injection", () => {
    it("should not allow random users to inject dependencies", async () => {
      await truffleAssert.reverts(token.setDependencies(contractsRegistry.address, "0x"), "Dependant: not an injector");
    });
  });

  describe("mint", () => {
    it("should mint correctly", async () => {
      await token.mint(SECOND, [0, "uri"], { from: MARKETPLACE });
      assert.equal(await token.ownerOf(0), SECOND);
    });

    it("should revert if not marketplace", async () => {
      await truffleAssert.reverts(token.mint(SECOND, [0, "uri"]), "ERC721MintableToken: Caller is not a marketplace.");
    });

    it("should revert if token already exists", async () => {
      await token.mint(SECOND, [0, "uri"], { from: MARKETPLACE });

      await truffleAssert.reverts(
        token.mint(SECOND, [0, "uri"], { from: MARKETPLACE }),
        "ERC721MintableToken: Token with such id already exists."
      );
    });

    it("should revert if token id is not equal to token index", async () => {
      await truffleAssert.reverts(
        token.mint(SECOND, [1, "uri"], { from: MARKETPLACE }),
        "ERC721MintableToken: Token id is not valid."
      );
    });

    it("should revert if token with such uri already exists", async () => {
      await token.mint(SECOND, [0, "uri"], { from: MARKETPLACE });

      await truffleAssert.reverts(
        token.mint(SECOND, [1, "uri"], { from: MARKETPLACE }),
        "ERC721MintableToken: Token with such URI already exists."
      );
    });
  });

  describe("tokenURI", () => {
    it("should return correct tokenURI", async () => {
      await token.mint(SECOND, [0, "uri"], { from: MARKETPLACE });
      await token.mint(SECOND, [1, ""], { from: MARKETPLACE });

      const marketplace1 = await Marketplace.new();
      marketplace1.__Marketplace_init("");

      const marketplace2 = await Marketplace.new();
      marketplace2.__Marketplace_init("base/");

      await contractsRegistry.addContract(await contractsRegistry.MARKETPLACE_NAME(), marketplace1.address);
      await tokenRegistry.injectDependenciesToExistingPools(0, 2);
      assert.equal(await token.tokenURI(0), "uri");
      assert.equal(await token.tokenURI(1), "");

      await contractsRegistry.addContract(await contractsRegistry.MARKETPLACE_NAME(), marketplace2.address);
      await tokenRegistry.injectDependenciesToExistingPools(0, 2);
      assert.equal(await token.tokenURI(0), "base/uri");
      assert.equal(await token.tokenURI(1), "base/");
    });

    it("should revert if token does not exist", async () => {
      const marketplace = await Marketplace.new();
      await contractsRegistry.addContract(await contractsRegistry.MARKETPLACE_NAME(), marketplace.address);
      await tokenRegistry.injectDependenciesToExistingPools(0, 1);

      await truffleAssert.reverts(token.tokenURI(0), "ERC721MintableToken: URI query for nonexistent token.");
    });
  });

  describe("nextTokenId", () => {
    it("should return correct next token id", async () => {
      assert.equal(await token.nextTokenId(), 0);

      await token.mint(SECOND, [0, ""], { from: MARKETPLACE });

      assert.equal(await token.nextTokenId(), 1);
    });
  });

  describe("getUserTokenIDs", () => {
    it("should return correct user token IDs arr", async () => {
      await token.mint(OWNER, [0, "0"], { from: MARKETPLACE });
      await token.mint(SECOND, [1, "1"], { from: MARKETPLACE });
      await token.mint(OWNER, [2, "2"], { from: MARKETPLACE });

      let tokenIDs = await token.getUserTokenIDs(OWNER);
      assert.deepEqual([tokenIDs[0].toString(), tokenIDs[1].toString()], ["0", "2"]);

      tokenIDs = await token.getUserTokenIDs(SECOND);
      assert.deepEqual([tokenIDs[0].toString()], ["1"]);

      assert.deepEqual(await token.getUserTokenIDs(NOTHING), []);
    });
  });
});
