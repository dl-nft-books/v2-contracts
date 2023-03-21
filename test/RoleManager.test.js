const { assert } = require("chai");
const { accounts } = require("../scripts/utils/utils");
const Reverter = require("./helpers/reverter");
const truffleAssert = require("truffle-assertions");

const ContractsRegistry = artifacts.require("ContractsRegistry");
const TokenFactory = artifacts.require("TokenFactory");
const TokenRegistry = artifacts.require("TokenRegistry");
const RoleManager = artifacts.require("RoleManager");
const Marketplace = artifacts.require("Marketplace");

describe("RoleManager", () => {
  let OWNER;
  let SECOND;
  let NOTHING;

  let ADMINISTRATOR_ROLE;
  let TOKEN_FACTORY_MANAGER_ROLE;
  let TOKEN_REGISTRY_MANAGER_ROLE;
  let TOKEN_MANAGER_ROLE;
  let ROLE_SUPERVISOR_ROLE;
  let WITHDRAWAL_MANAGER_ROLE;
  let MARKETPLACE_MANAGER_ROLE;

  let contractsRegistry;
  let roleManager;

  const reverter = new Reverter();

  before("setup", async () => {
    OWNER = await accounts(0);
    SECOND = await accounts(1);
    NOTHING = await accounts(9);

    contractsRegistry = await ContractsRegistry.new();
    const _tokenFactory = await TokenFactory.new();
    const _tokenRegistry = await TokenRegistry.new();
    const _roleManager = await RoleManager.new();
    const _marketplace = await Marketplace.new();

    await contractsRegistry.__OwnableContractsRegistry_init();
    await _roleManager.__RoleManager_init();

    await contractsRegistry.addProxyContract(await contractsRegistry.TOKEN_FACTORY_NAME(), _tokenFactory.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.TOKEN_REGISTRY_NAME(), _tokenRegistry.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.MARKETPLACE_NAME(), _marketplace.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.ROLE_MANAGER_NAME(), _roleManager.address);

    roleManager = await RoleManager.at(await contractsRegistry.getRoleManagerContract());

    await contractsRegistry.injectDependencies(await contractsRegistry.TOKEN_FACTORY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.TOKEN_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.MARKETPLACE_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.ROLE_MANAGER_NAME());

    ADMINISTRATOR_ROLE = await roleManager.ADMINISTRATOR_ROLE();
    TOKEN_FACTORY_MANAGER_ROLE = await roleManager.TOKEN_FACTORY_MANAGER();
    TOKEN_REGISTRY_MANAGER_ROLE = await roleManager.TOKEN_REGISTRY_MANAGER();
    TOKEN_MANAGER_ROLE = await roleManager.TOKEN_MANAGER();
    ROLE_SUPERVISOR_ROLE = await roleManager.ROLE_SUPERVISOR();
    WITHDRAWAL_MANAGER_ROLE = await roleManager.WITHDRAWAL_MANAGER();
    MARKETPLACE_MANAGER_ROLE = await roleManager.MARKETPLACE_MANAGER();

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("creation", () => {
    it("should correctly setup roles", async () => {
      assert.equal(await roleManager.getRoleMemberCount(ADMINISTRATOR_ROLE), 0);
      assert.equal(await roleManager.getRoleMemberCount(TOKEN_FACTORY_MANAGER_ROLE), 0);
      assert.equal(await roleManager.getRoleMemberCount(TOKEN_REGISTRY_MANAGER_ROLE), 0);
      assert.equal(await roleManager.getRoleMemberCount(TOKEN_MANAGER_ROLE), 0);
      assert.equal(await roleManager.getRoleMemberCount(ROLE_SUPERVISOR_ROLE), 0);
      assert.equal(await roleManager.getRoleMemberCount(WITHDRAWAL_MANAGER_ROLE), 0);
      assert.equal(await roleManager.getRoleMemberCount(MARKETPLACE_MANAGER_ROLE), 0);

      assert.equal(await roleManager.getRoleAdmin(ADMINISTRATOR_ROLE), await roleManager.DEFAULT_ADMIN_ROLE());
      assert.equal(await roleManager.getRoleAdmin(TOKEN_FACTORY_MANAGER_ROLE), await roleManager.DEFAULT_ADMIN_ROLE());
      assert.equal(await roleManager.getRoleAdmin(TOKEN_REGISTRY_MANAGER_ROLE), await roleManager.DEFAULT_ADMIN_ROLE());
      assert.equal(await roleManager.getRoleAdmin(TOKEN_MANAGER_ROLE), await roleManager.DEFAULT_ADMIN_ROLE());
      assert.equal(await roleManager.getRoleAdmin(ROLE_SUPERVISOR_ROLE), await roleManager.DEFAULT_ADMIN_ROLE());
      assert.equal(await roleManager.getRoleAdmin(WITHDRAWAL_MANAGER_ROLE), await roleManager.DEFAULT_ADMIN_ROLE());
      assert.equal(await roleManager.getRoleAdmin(MARKETPLACE_MANAGER_ROLE), await roleManager.DEFAULT_ADMIN_ROLE());

      await roleManager.__RoleManager_init();

      assert.equal(await roleManager.getRoleMemberCount(ADMINISTRATOR_ROLE), 1);
      assert.equal(await roleManager.getRoleMemberCount(TOKEN_FACTORY_MANAGER_ROLE), 0);
      assert.equal(await roleManager.getRoleMemberCount(TOKEN_REGISTRY_MANAGER_ROLE), 0);
      assert.equal(await roleManager.getRoleMemberCount(TOKEN_MANAGER_ROLE), 0);
      assert.equal(await roleManager.getRoleMemberCount(ROLE_SUPERVISOR_ROLE), 0);
      assert.equal(await roleManager.getRoleMemberCount(WITHDRAWAL_MANAGER_ROLE), 0);
      assert.equal(await roleManager.getRoleMemberCount(MARKETPLACE_MANAGER_ROLE), 0);

      assert.equal(await roleManager.getRoleAdmin(ADMINISTRATOR_ROLE), ADMINISTRATOR_ROLE);
      assert.equal(await roleManager.getRoleAdmin(TOKEN_FACTORY_MANAGER_ROLE), ROLE_SUPERVISOR_ROLE);
      assert.equal(await roleManager.getRoleAdmin(TOKEN_REGISTRY_MANAGER_ROLE), ROLE_SUPERVISOR_ROLE);
      assert.equal(await roleManager.getRoleAdmin(TOKEN_MANAGER_ROLE), ROLE_SUPERVISOR_ROLE);
      assert.equal(await roleManager.getRoleAdmin(ROLE_SUPERVISOR_ROLE), ADMINISTRATOR_ROLE);
      assert.equal(await roleManager.getRoleAdmin(WITHDRAWAL_MANAGER_ROLE), ROLE_SUPERVISOR_ROLE);
      assert.equal(await roleManager.getRoleAdmin(MARKETPLACE_MANAGER_ROLE), ROLE_SUPERVISOR_ROLE);

      assert.equal(await roleManager.getRoleMember(ADMINISTRATOR_ROLE, 0), OWNER);
    });

    it("should get exception if contract already initialized", async () => {
      await roleManager.__RoleManager_init();

      await truffleAssert.reverts(roleManager.__RoleManager_init(), "Initializable: contract is already initialized");
    });
  });

  describe("dependency injection", () => {
    it("should not allow random users to inject dependencies", async () => {
      await truffleAssert.reverts(
        roleManager.setDependencies(contractsRegistry.address, "0x"),
        "Dependant: not an injector"
      );
    });
  });

  describe("administrator should be able to be every role", () => {
    it("administrator should be able to be every role", async () => {
      await roleManager.__RoleManager_init();

      assert.equal(await roleManager.isAdmin(OWNER), true);
      assert.equal(await roleManager.isTokenFactoryManager(OWNER), true);
      assert.equal(await roleManager.isTokenRegistryManager(OWNER), true);
      assert.equal(await roleManager.isTokenManager(OWNER), true);
      assert.equal(await roleManager.isRoleSupervisor(OWNER), true);
      assert.equal(await roleManager.isWithdrawalManager(OWNER), true);
      assert.equal(await roleManager.isMarketplaceManager(OWNER), true);
    });
  });

  describe("should correctly add and remove roles", () => {
    beforeEach(async () => {
      await roleManager.__RoleManager_init();
      await roleManager.grantRole(ROLE_SUPERVISOR_ROLE, OWNER);
    });

    it("isAdmin()", async () => {
      assert.equal(await roleManager.isAdmin(NOTHING), false);

      await roleManager.grantRole(ADMINISTRATOR_ROLE, NOTHING);
      assert.equal(await roleManager.isAdmin(NOTHING), true);

      await roleManager.grantRole(ADMINISTRATOR_ROLE, SECOND);
      assert.equal(await roleManager.isAdmin(SECOND), true);

      await roleManager.revokeRole(ADMINISTRATOR_ROLE, SECOND);
      assert.equal(await roleManager.isAdmin(SECOND), false);
    });

    it("should revert if tries to remove last admin", async () => {
      await truffleAssert.reverts(
        roleManager.revokeRole(ADMINISTRATOR_ROLE, OWNER),
        "RoleManager: cannot revoke last administrator"
      );
    });

    it("isTokenFactoryManager()", async () => {
      assert.equal(await roleManager.isTokenFactoryManager(NOTHING), false);

      await roleManager.grantRole(TOKEN_FACTORY_MANAGER_ROLE, NOTHING);
      assert.equal(await roleManager.isTokenFactoryManager(NOTHING), true);

      await roleManager.revokeRole(TOKEN_FACTORY_MANAGER_ROLE, NOTHING);
      assert.equal(await roleManager.isTokenFactoryManager(NOTHING), false);
    });

    it("isTokenRegistryManager()", async () => {
      assert.equal(await roleManager.isTokenRegistryManager(NOTHING), false);

      await roleManager.grantRole(TOKEN_REGISTRY_MANAGER_ROLE, NOTHING);
      assert.equal(await roleManager.isTokenRegistryManager(NOTHING), true);

      await roleManager.revokeRole(TOKEN_REGISTRY_MANAGER_ROLE, NOTHING);
      assert.equal(await roleManager.isTokenRegistryManager(NOTHING), false);
    });

    it("isTokenManager()", async () => {
      assert.equal(await roleManager.isTokenManager(NOTHING), false);

      await roleManager.grantRole(TOKEN_MANAGER_ROLE, NOTHING);
      assert.equal(await roleManager.isTokenManager(NOTHING), true);

      await roleManager.revokeRole(TOKEN_MANAGER_ROLE, NOTHING);
      assert.equal(await roleManager.isTokenManager(NOTHING), false);
    });

    it("isRoleSupervisor()", async () => {
      assert.equal(await roleManager.isRoleSupervisor(NOTHING), false);

      await roleManager.grantRole(ROLE_SUPERVISOR_ROLE, NOTHING);
      assert.equal(await roleManager.isRoleSupervisor(NOTHING), true);

      await roleManager.revokeRole(ROLE_SUPERVISOR_ROLE, NOTHING);
      assert.equal(await roleManager.isRoleSupervisor(NOTHING), false);
    });

    it("isWithdrawalManager()", async () => {
      assert.equal(await roleManager.isWithdrawalManager(NOTHING), false);

      await roleManager.grantRole(WITHDRAWAL_MANAGER_ROLE, NOTHING);
      assert.equal(await roleManager.isWithdrawalManager(NOTHING), true);

      await roleManager.revokeRole(WITHDRAWAL_MANAGER_ROLE, NOTHING);
      assert.equal(await roleManager.isWithdrawalManager(NOTHING), false);
    });

    it("isMarketplaceManager()", async () => {
      assert.equal(await roleManager.isMarketplaceManager(NOTHING), false);

      await roleManager.grantRole(MARKETPLACE_MANAGER_ROLE, NOTHING);
      assert.equal(await roleManager.isMarketplaceManager(NOTHING), true);

      await roleManager.revokeRole(MARKETPLACE_MANAGER_ROLE, NOTHING);
      assert.equal(await roleManager.isMarketplaceManager(NOTHING), false);
    });
  });

  describe("grantRoleBatch()", async () => {
    beforeEach(async () => {
      await roleManager.__RoleManager_init();
      await roleManager.grantRole(ROLE_SUPERVISOR_ROLE, OWNER);
    });
    it("should grant roles", async () => {
      const users = [NOTHING, SECOND];
      const roles = [TOKEN_FACTORY_MANAGER_ROLE, TOKEN_REGISTRY_MANAGER_ROLE];

      await roleManager.grantRoleBatch(roles, users);

      assert.equal(await roleManager.isTokenFactoryManager(NOTHING), true);
      assert.equal(await roleManager.isTokenRegistryManager(SECOND), true);
    });

    it("should revert if roles and users length mismatch", async () => {
      const users = [NOTHING, SECOND];
      const roles = [TOKEN_FACTORY_MANAGER_ROLE];

      await truffleAssert.reverts(
        roleManager.grantRoleBatch(roles, users),
        "RoleManager: roles and accounts arrays must be of equal length"
      );
    });
  });
});
