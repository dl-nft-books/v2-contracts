const { assert } = require("chai");
const { wei, accounts, toBN } = require("../../scripts/utils/utils");
const Reverter = require("../helpers/reverter");
const truffleAssert = require("truffle-assertions");

const ERC721MintableToken = artifacts.require("ERC721MintableToken");
const ContractsRegistry = artifacts.require("ContractsRegistry");
const RoleManager = artifacts.require("RoleManager");
const TokenRegistry = artifacts.require("TokenRegistry");

describe("ERC721MintableToken", () => {
  let OWNER;
  let SECOND;
  let MARKETPLACE;
  let FACTORY;
  let NOTHING;

  let token;
  let contractsRegistry;
  let tokenRegistry;
  let tokenFactory;
  let TOKEN_POOL;

  const priceDecimals = toBN(18);
  const reverter = new Reverter();

  before("setup", async () => {
    OWNER = await accounts(0);
    SECOND = await accounts(1);
    MARKETPLACE = await accounts(2);
    FACTORY = await accounts(3);
    NOTHING = await accounts(4);

    contractsRegistry = await ContractsRegistry.new();
    const _roleManager = await RoleManager.new();
    // const _tokenFactory = await TokenFactory.new();
    const _tokenRegistry = await TokenRegistry.new();

    await contractsRegistry.__OwnableContractsRegistry_init();

    await contractsRegistry.addContract(await contractsRegistry.MARKETPLACE_NAME(), MARKETPLACE);
    await contractsRegistry.addProxyContract(await contractsRegistry.ROLE_MANAGER_NAME(), _roleManager.address);
    await contractsRegistry.addContract(await contractsRegistry.TOKEN_FACTORY_NAME(), FACTORY);
    await contractsRegistry.addProxyContract(await contractsRegistry.TOKEN_REGISTRY_NAME(), _tokenRegistry.address);

    await (await RoleManager.at(await contractsRegistry.getRoleManagerContract())).__RoleManager_init();
    tokenRegistry = await TokenRegistry.at(await contractsRegistry.getTokenRegistryContract());

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
    it("should set correct data after deployment", async () => {});
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

  describe("mint()", () => {
    it("should mint correctly", async () => {
      await token.mint(SECOND, 0, "uri", { from: MARKETPLACE });
      assert.equal(await token.ownerOf(0), SECOND);
    });

    it("should revert if not marketplace", async () => {
      await truffleAssert.reverts(token.mint(SECOND, 0, "uri"), "ERC721MintableToken: Caller is not a marketplace.");
    });

    it("should revert if token already exists", async () => {
      await token.mint(SECOND, 0, "uri", { from: MARKETPLACE });
      await truffleAssert.reverts(
        token.mint(SECOND, 0, "uri", { from: MARKETPLACE }),
        "ERC721MintableToken: Token with such id already exists."
      );
    });

    it("should revert if token id is not equal to token index", async () => {
      await truffleAssert.reverts(
        token.mint(SECOND, 1, "uri", { from: MARKETPLACE }),
        "ERC721MintableToken: Token id is not valid."
      );
    });

    it("should revert if token with such uri already exists", async () => {
      await token.mint(SECOND, 0, "uri", { from: MARKETPLACE });
      await truffleAssert.reverts(
        token.mint(SECOND, 1, "uri", { from: MARKETPLACE }),
        "ERC721MintableToken: Token with such URI already exists."
      );
    });
  });

  describe("tokenURI()", () => {
    it("should return correct tokenURI", async () => {
      await token.mint(SECOND, 0, "uri", { from: MARKETPLACE });
      assert.equal(await token.tokenURI(0), "uri");
    });

    it("should revert if token does not exist", async () => {
      await truffleAssert.reverts(token.tokenURI(0), "ERC721MintableToken: URI query for nonexistent token.");
    });
  });

  describe("burn()", () => {
    it("should burn correctly", async () => {
      await token.mint(SECOND, 0, "", { from: MARKETPLACE });

      await token.burn(0);
      await truffleAssert.reverts(token.ownerOf(0), "ERC721: owner query for nonexistent token");
    });

    it("should revert if not a token manager", async () => {
      await token.mint(SECOND, 0, "uri", { from: MARKETPLACE });

      await truffleAssert.reverts(
        token.burn(0, { from: MARKETPLACE }),
        "ERC721MintableToken: Caller is not a token manager."
      );
    });
  });

  describe("updateTokenParams()", () => {
    it("should update token params correctly", async () => {
      await token.updateTokenParams("Name", "Symbol", { from: MARKETPLACE });
      assert.equal(await token.name(), "Name");
      assert.equal(await token.symbol(), "Symbol");
    });

    it("should revert if not a marketplace", async () => {
      await truffleAssert.reverts(
        token.updateTokenParams("Name", "Symbol", { from: NOTHING }),
        "ERC721MintableToken: Caller is not a marketplace."
      );
    });
  });
});
