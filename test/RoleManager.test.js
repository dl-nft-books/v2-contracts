const { assert } = require("chai");
const { accounts } = require("../scripts/utils/utils");
const { ZERO_BYTES } = require("../scripts/utils/constants");
const { parseConfig } = require("../deploy/helpers/deployHelper");

const Reverter = require("./helpers/reverter");
const truffleAssert = require("truffle-assertions");
const { web3 } = require("hardhat");

const ContractsRegistry = artifacts.require("ContractsRegistry");
const TokenFactory = artifacts.require("TokenFactory");
const TokenRegistry = artifacts.require("TokenRegistry");
const RoleManager = artifacts.require("RoleManager");
const Marketplace = artifacts.require("Marketplace");

describe.only("RoleManager", () => {
  let OWNER;
  let USER1;
  let USER2;
  let NOTHING;

  let ADMINISTRATOR_ROLE;
  let TOKEN_FACTORY_MANAGER_ROLE;
  let TOKEN_REGISTRY_MANAGER_ROLE;
  let TOKEN_MANAGER_ROLE;
  let ROLE_SUPERVISOR_ROLE;
  let WITHDRAWAL_MANAGER_ROLE;
  let MARKETPLACE_MANAGER_ROLE;
  let SIGNATURE_MANAGER_ROLE;

  let contractsRegistry;
  let roleManager;

  const reverter = new Reverter();

  before("setup", async () => {
    OWNER = await accounts(0);
    USER1 = await accounts(1);
    USER2 = await accounts(2);
    NOTHING = await accounts(9);

    contractsRegistry = await ContractsRegistry.new();
    const _tokenFactory = await TokenFactory.new();
    const _tokenRegistry = await TokenRegistry.new();
    const _roleManager = await RoleManager.new();
    const _marketplace = await Marketplace.new();

    await contractsRegistry.__OwnableContractsRegistry_init();

    await contractsRegistry.addProxyContract(await contractsRegistry.TOKEN_FACTORY_NAME(), _tokenFactory.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.TOKEN_REGISTRY_NAME(), _tokenRegistry.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.MARKETPLACE_NAME(), _marketplace.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.ROLE_MANAGER_NAME(), _roleManager.address);

    const config = parseConfig("./test/data/config.test.json");
    roleManager = await RoleManager.at(await contractsRegistry.getRoleManagerContract());

    await roleManager.__RoleManager_init(config.roleInitParams);

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
    SIGNATURE_MANAGER_ROLE = await roleManager.SIGNATURE_MANAGER();

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("updateRolesParams", () => {
    const newRole = web3.utils.keccak256("NEW_ROLE");

    it("should correctly add new roles", async () => {
      const newRoles = [[newRole, ROLE_SUPERVISOR_ROLE, "New role"]];

      const tx = await roleManager.updateRolesParams(newRoles);

      const log = tx.receipt.logs[0];

      assert.equal(log.event, "RoleAdminChanged");
      assert.equal(log.args.role, newRole);
      assert.equal(log.args.previousAdminRole, ZERO_BYTES);
      assert.equal(log.args.newAdminRole, ROLE_SUPERVISOR_ROLE);

      assert.isTrue(await roleManager.isRoleExists(newRole));

      await roleManager.grantRole(newRole, USER2);

      assert.isTrue(await roleManager.hasRole(newRole, USER2));

      const roleInfo = (await roleManager.getRolesDetailedInfo([newRole]))[0];

      assert.equal(roleInfo.roleName, "New role");
      assert.equal(roleInfo.role, newRole);
      assert.equal(roleInfo.roleAdmin, ROLE_SUPERVISOR_ROLE);
      assert.deepEqual(roleInfo.members, [USER2]);
    });

    it("should correctly change already existing role", async () => {
      const newRoles = [[newRole, ROLE_SUPERVISOR_ROLE, "New role"]];

      await roleManager.updateRolesParams(newRoles);

      const changedRoleParams = [[newRole, ADMINISTRATOR_ROLE, "Changed role name"]];

      await roleManager.updateRolesParams(changedRoleParams);

      const roleInfo = (await roleManager.getRolesDetailedInfo([newRole]))[0];

      assert.equal(roleInfo.roleName, "Changed role name");
      assert.equal(roleInfo.role, newRole);
      assert.equal(roleInfo.roleAdmin, ADMINISTRATOR_ROLE);
      assert.deepEqual(roleInfo.members, []);
    });

    it("should get exception if non administrator try to call this function", async () => {
      const reason = `AccessControl: account ${web3.utils.toHex(USER2)} is missing role ${ADMINISTRATOR_ROLE}`;

      const newParams = [[web3.utils.keccak256("NEW_ROLE"), ADMINISTRATOR_ROLE, "Some new role"]];
      await truffleAssert.reverts(roleManager.updateRolesParams(newParams, { from: USER2 }), reason);
    });

    it("should get exception if pass empty role name string", async () => {
      const reason = "RoleManager: Role name cannot be an empty string";

      const wrongRoleParams = [[newRole, ADMINISTRATOR_ROLE, ""]];

      await truffleAssert.reverts(roleManager.updateRolesParams(wrongRoleParams), reason);
    });
  });

  describe("removeRoles", () => {
    const role = web3.utils.keccak256("NEW_ROLE");

    it("should correctly remove roles", async () => {
      const newParams = [[role, ADMINISTRATOR_ROLE, "Some new role"]];

      await roleManager.updateRolesParams(newParams);

      await roleManager.grantRole(role, USER2);

      assert.isTrue(await roleManager.hasRole(role, USER2));

      await roleManager.removeRoles([role]);

      assert.isFalse(await roleManager.hasRole(role, USER2));
      assert.isFalse(await roleManager.isRoleExists(role));

      const roleInfo = (await roleManager.getRolesDetailedInfo([role]))[0];
      assert.equal(roleInfo.roleName, "");
    });

    it("should get exception if try to remove nonexisting role", async () => {
      const reason = "RoleManager: Role does not exists";

      await truffleAssert.reverts(roleManager.removeRoles([role]), reason);
    });

    it("should get exception if non administrator try to call this function", async () => {
      const reason = `AccessControl: account ${web3.utils.toHex(USER2)} is missing role ${ADMINISTRATOR_ROLE}`;

      const newParams = [[role, ADMINISTRATOR_ROLE, "Some new role"]];
      await roleManager.updateRolesParams(newParams);

      await truffleAssert.reverts(roleManager.removeRoles([role], { from: USER2 }), reason);
    });
  });

  describe("grantRolesBatch", () => {
    it("should correctly grant roles", async () => {
      const tx = await roleManager.grantRolesBatch(
        [WITHDRAWAL_MANAGER_ROLE, MARKETPLACE_MANAGER_ROLE],
        [[USER1], [USER2, USER1]]
      );

      const roles = [WITHDRAWAL_MANAGER_ROLE, MARKETPLACE_MANAGER_ROLE, MARKETPLACE_MANAGER_ROLE];
      const users = [USER1, USER2, USER1];

      for (let i = 0; i < roles.length; i++) {
        const log = tx.receipt.logs[i];

        assert.equal(log.event, "RoleGranted");
        assert.equal(log.args.role, roles[i]);
        assert.equal(log.args.account, users[i]);
        assert.equal(log.args.sender, OWNER);
      }

      assert.deepEqual(await roleManager.getRoleMembers(WITHDRAWAL_MANAGER_ROLE), [USER1]);
      assert.deepEqual(await roleManager.getRoleMembers(MARKETPLACE_MANAGER_ROLE), [USER2, USER1]);

      assert.isTrue(await roleManager.hasRole(WITHDRAWAL_MANAGER_ROLE, USER1));

      assert.isTrue(await roleManager.hasRole(MARKETPLACE_MANAGER_ROLE, USER1));
      assert.isTrue(await roleManager.hasRole(MARKETPLACE_MANAGER_ROLE, USER2));

      assert.deepEqual(await roleManager.getUserRoles(USER1), [WITHDRAWAL_MANAGER_ROLE, MARKETPLACE_MANAGER_ROLE]);
      assert.deepEqual(await roleManager.getUserRoles(USER2), [MARKETPLACE_MANAGER_ROLE]);
    });

    it("should get exception if user does not have needed role to grant roles", async () => {
      await roleManager.grantRole(ROLE_SUPERVISOR_ROLE, USER1);

      const reason = `AccessControl: account ${web3.utils.toHex(USER1)} is missing role ${ADMINISTRATOR_ROLE}`;
      await truffleAssert.reverts(
        roleManager.grantRolesBatch([MARKETPLACE_MANAGER_ROLE, ADMINISTRATOR_ROLE], [[USER2], [USER1]], {
          from: USER1,
        }),
        reason
      );
    });

    it("should get exception if pass arrays of different lengths", async () => {
      const reason = "RoleManager: Roles and accounts arrays must be of equal length";

      await truffleAssert.reverts(
        roleManager.grantRolesBatch([ADMINISTRATOR_ROLE, MARKETPLACE_MANAGER_ROLE], [[USER1]]),
        reason
      );
    });
  });

  describe("revokeRolesBatch", () => {
    it("should correctly revoke roles", async () => {
      const USER3 = await accounts(3);

      await roleManager.grantRole(ROLE_SUPERVISOR_ROLE, USER1);
      await roleManager.grantRolesBatch([MARKETPLACE_MANAGER_ROLE, SIGNATURE_MANAGER_ROLE], [[USER1, USER2], [USER3]], {
        from: USER1,
      });

      const tx = await roleManager.revokeRolesBatch(
        [MARKETPLACE_MANAGER_ROLE, SIGNATURE_MANAGER_ROLE],
        [[USER2], [USER3]],
        { from: USER1 }
      );

      const roles = [MARKETPLACE_MANAGER_ROLE, SIGNATURE_MANAGER_ROLE];
      const users = [USER2, USER3];

      for (let i = 0; i < roles.length; i++) {
        const log = tx.receipt.logs[i];

        assert.equal(log.event, "RoleRevoked");
        assert.equal(log.args.role, roles[i]);
        assert.equal(log.args.account, users[i]);
        assert.equal(log.args.sender, USER1);
      }

      assert.isTrue(await roleManager.hasRole(MARKETPLACE_MANAGER_ROLE, USER1));
      assert.isFalse(await roleManager.hasRole(MARKETPLACE_MANAGER_ROLE, USER2));

      assert.isFalse(await roleManager.hasRole(SIGNATURE_MANAGER_ROLE, USER3));

      assert.deepEqual(await roleManager.getRoleMembers(SIGNATURE_MANAGER_ROLE), []);
      assert.deepEqual(await roleManager.getRoleMembers(MARKETPLACE_MANAGER_ROLE), [USER1]);

      assert.deepEqual(await roleManager.getUserRoles(USER2), []);
      assert.deepEqual(await roleManager.getUserRoles(USER3), []);
    });

    it("should get exception if user does not have needed role to grant roles", async () => {
      await roleManager.grantRolesBatch([ROLE_SUPERVISOR_ROLE], [[USER1, USER2]]);

      const reason = `AccessControl: account ${web3.utils.toHex(USER1)} is missing role ${ADMINISTRATOR_ROLE}`;
      await truffleAssert.reverts(
        roleManager.revokeRolesBatch([ROLE_SUPERVISOR_ROLE, ADMINISTRATOR_ROLE], [[USER2], [OWNER]], { from: USER1 }),
        reason
      );
    });

    it("should get exception if pass arrays of different lengths", async () => {
      const reason = "RoleManager: Roles and accounts arrays must be of equal length";

      await truffleAssert.reverts(
        roleManager.revokeRolesBatch([ADMINISTRATOR_ROLE, MARKETPLACE_MANAGER_ROLE], [[USER1]]),
        reason
      );
    });

    it("should get exception if try to remove last admin account", async () => {
      await roleManager.grantRole(ADMINISTRATOR_ROLE, USER1);

      const reason = "RoleManager: Cannot remove last administrator";

      await truffleAssert.reverts(
        roleManager.revokeRolesBatch([ADMINISTRATOR_ROLE], [[OWNER, USER1]], { from: USER1 }),
        reason
      );
    });
  });

  // describe("creation", () => {
  //   it("should correctly setup roles", async () => {
  //     assert.equal(await roleManager.getRoleMemberCount(ADMINISTRATOR_ROLE), 0);
  //     assert.equal(await roleManager.getRoleMemberCount(TOKEN_FACTORY_MANAGER_ROLE), 0);
  //     assert.equal(await roleManager.getRoleMemberCount(TOKEN_REGISTRY_MANAGER_ROLE), 0);
  //     assert.equal(await roleManager.getRoleMemberCount(TOKEN_MANAGER_ROLE), 0);
  //     assert.equal(await roleManager.getRoleMemberCount(ROLE_SUPERVISOR_ROLE), 0);
  //     assert.equal(await roleManager.getRoleMemberCount(WITHDRAWAL_MANAGER_ROLE), 0);
  //     assert.equal(await roleManager.getRoleMemberCount(MARKETPLACE_MANAGER_ROLE), 0);

  //     assert.equal(await roleManager.getRoleAdmin(ADMINISTRATOR_ROLE), await roleManager.DEFAULT_ADMIN_ROLE());
  //     assert.equal(await roleManager.getRoleAdmin(TOKEN_FACTORY_MANAGER_ROLE), await roleManager.DEFAULT_ADMIN_ROLE());
  //     assert.equal(await roleManager.getRoleAdmin(TOKEN_REGISTRY_MANAGER_ROLE), await roleManager.DEFAULT_ADMIN_ROLE());
  //     assert.equal(await roleManager.getRoleAdmin(TOKEN_MANAGER_ROLE), await roleManager.DEFAULT_ADMIN_ROLE());
  //     assert.equal(await roleManager.getRoleAdmin(ROLE_SUPERVISOR_ROLE), await roleManager.DEFAULT_ADMIN_ROLE());
  //     assert.equal(await roleManager.getRoleAdmin(WITHDRAWAL_MANAGER_ROLE), await roleManager.DEFAULT_ADMIN_ROLE());
  //     assert.equal(await roleManager.getRoleAdmin(MARKETPLACE_MANAGER_ROLE), await roleManager.DEFAULT_ADMIN_ROLE());

  //     await roleManager.__RoleManager_init();

  //     assert.equal(await roleManager.getRoleMemberCount(ADMINISTRATOR_ROLE), 1);
  //     assert.equal(await roleManager.getRoleMemberCount(TOKEN_FACTORY_MANAGER_ROLE), 0);
  //     assert.equal(await roleManager.getRoleMemberCount(TOKEN_REGISTRY_MANAGER_ROLE), 0);
  //     assert.equal(await roleManager.getRoleMemberCount(TOKEN_MANAGER_ROLE), 0);
  //     assert.equal(await roleManager.getRoleMemberCount(ROLE_SUPERVISOR_ROLE), 0);
  //     assert.equal(await roleManager.getRoleMemberCount(WITHDRAWAL_MANAGER_ROLE), 0);
  //     assert.equal(await roleManager.getRoleMemberCount(MARKETPLACE_MANAGER_ROLE), 0);

  //     assert.equal(await roleManager.getRoleAdmin(ADMINISTRATOR_ROLE), ADMINISTRATOR_ROLE);
  //     assert.equal(await roleManager.getRoleAdmin(TOKEN_FACTORY_MANAGER_ROLE), ROLE_SUPERVISOR_ROLE);
  //     assert.equal(await roleManager.getRoleAdmin(TOKEN_REGISTRY_MANAGER_ROLE), ROLE_SUPERVISOR_ROLE);
  //     assert.equal(await roleManager.getRoleAdmin(TOKEN_MANAGER_ROLE), ROLE_SUPERVISOR_ROLE);
  //     assert.equal(await roleManager.getRoleAdmin(ROLE_SUPERVISOR_ROLE), ADMINISTRATOR_ROLE);
  //     assert.equal(await roleManager.getRoleAdmin(WITHDRAWAL_MANAGER_ROLE), ROLE_SUPERVISOR_ROLE);
  //     assert.equal(await roleManager.getRoleAdmin(MARKETPLACE_MANAGER_ROLE), ROLE_SUPERVISOR_ROLE);

  //     assert.equal(await roleManager.getRoleMember(ADMINISTRATOR_ROLE, 0), OWNER);
  //   });

  //   it("should get exception if contract already initialized", async () => {
  //     await roleManager.__RoleManager_init();

  //     await truffleAssert.reverts(roleManager.__RoleManager_init(), "Initializable: contract is already initialized");
  //   });
  // });

  // describe("dependency injection", () => {
  //   it("should not allow random users to inject dependencies", async () => {
  //     await truffleAssert.reverts(
  //       roleManager.setDependencies(contractsRegistry.address, "0x"),
  //       "Dependant: not an injector"
  //     );
  //   });
  // });

  // describe("administrator should be able to be every role", () => {
  //   it("administrator should be able to be every role", async () => {
  //     await roleManager.__RoleManager_init();

  //     assert.equal(await roleManager.isAdmin(OWNER), true);
  //     assert.equal(await roleManager.isTokenFactoryManager(OWNER), true);
  //     assert.equal(await roleManager.isTokenRegistryManager(OWNER), true);
  //     assert.equal(await roleManager.isTokenManager(OWNER), true);
  //     assert.equal(await roleManager.isRoleSupervisor(OWNER), true);
  //     assert.equal(await roleManager.isWithdrawalManager(OWNER), true);
  //     assert.equal(await roleManager.isMarketplaceManager(OWNER), true);
  //   });
  // });

  // describe("should correctly add and remove roles", () => {
  //   beforeEach(async () => {
  //     await roleManager.__RoleManager_init();
  //     await roleManager.grantRole(ROLE_SUPERVISOR_ROLE, OWNER);
  //   });

  //   it("isAdmin()", async () => {
  //     assert.equal(await roleManager.isAdmin(NOTHING), false);

  //     await roleManager.grantRole(ADMINISTRATOR_ROLE, NOTHING);
  //     assert.equal(await roleManager.isAdmin(NOTHING), true);

  //     await roleManager.grantRole(ADMINISTRATOR_ROLE, USER1);
  //     assert.equal(await roleManager.isAdmin(USER1), true);

  //     await roleManager.revokeRole(ADMINISTRATOR_ROLE, USER1);
  //     assert.equal(await roleManager.isAdmin(USER1), false);
  //   });

  //   it("should revert if tries to remove last admin", async () => {
  //     await truffleAssert.reverts(
  //       roleManager.revokeRole(ADMINISTRATOR_ROLE, OWNER),
  //       "RoleManager: cannot remove last administrator"
  //     );
  //   });

  //   it("should revert if tries to renounce last admin", async () => {
  //     await roleManager.grantRole(ADMINISTRATOR_ROLE, USER1);
  //     assert.equal(await roleManager.getRoleMemberCount(ADMINISTRATOR_ROLE), 2);
  //     await roleManager.renounceRole(ADMINISTRATOR_ROLE, USER1, { from: USER1 });
  //     await truffleAssert.reverts(
  //       roleManager.renounceRole(ADMINISTRATOR_ROLE, OWNER, { from: OWNER }),
  //       "RoleManager: cannot remove last administrator"
  //     );
  //   });

  //   it("isTokenFactoryManager()", async () => {
  //     assert.equal(await roleManager.isTokenFactoryManager(NOTHING), false);

  //     await roleManager.grantRole(TOKEN_FACTORY_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.isTokenFactoryManager(NOTHING), true);

  //     await roleManager.revokeRole(TOKEN_FACTORY_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.isTokenFactoryManager(NOTHING), false);

  //     await roleManager.grantRole(TOKEN_FACTORY_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.isTokenFactoryManager(NOTHING), true);

  //     await roleManager.renounceRole(TOKEN_FACTORY_MANAGER_ROLE, NOTHING, { from: NOTHING });
  //     assert.equal(await roleManager.isTokenFactoryManager(NOTHING), false);
  //   });

  //   it("isTokenRegistryManager()", async () => {
  //     assert.equal(await roleManager.isTokenRegistryManager(NOTHING), false);

  //     await roleManager.grantRole(TOKEN_REGISTRY_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.isTokenRegistryManager(NOTHING), true);

  //     await roleManager.revokeRole(TOKEN_REGISTRY_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.isTokenRegistryManager(NOTHING), false);

  //     await roleManager.grantRole(TOKEN_REGISTRY_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.isTokenRegistryManager(NOTHING), true);

  //     await roleManager.renounceRole(TOKEN_REGISTRY_MANAGER_ROLE, NOTHING, { from: NOTHING });
  //     assert.equal(await roleManager.isTokenRegistryManager(NOTHING), false);
  //   });

  //   it("isTokenManager()", async () => {
  //     assert.equal(await roleManager.isTokenManager(NOTHING), false);

  //     await roleManager.grantRole(TOKEN_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.isTokenManager(NOTHING), true);

  //     await roleManager.revokeRole(TOKEN_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.isTokenManager(NOTHING), false);

  //     await roleManager.grantRole(TOKEN_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.isTokenManager(NOTHING), true);

  //     await roleManager.renounceRole(TOKEN_MANAGER_ROLE, NOTHING, { from: NOTHING });
  //     assert.equal(await roleManager.isTokenManager(NOTHING), false);
  //   });

  //   it("isRoleSupervisor()", async () => {
  //     assert.equal(await roleManager.isRoleSupervisor(NOTHING), false);

  //     await roleManager.grantRole(ROLE_SUPERVISOR_ROLE, NOTHING);
  //     assert.equal(await roleManager.isRoleSupervisor(NOTHING), true);

  //     await roleManager.revokeRole(ROLE_SUPERVISOR_ROLE, NOTHING);
  //     assert.equal(await roleManager.isRoleSupervisor(NOTHING), false);

  //     await roleManager.grantRole(ROLE_SUPERVISOR_ROLE, NOTHING);
  //     assert.equal(await roleManager.isRoleSupervisor(NOTHING), true);

  //     await roleManager.renounceRole(ROLE_SUPERVISOR_ROLE, NOTHING, { from: NOTHING });
  //     assert.equal(await roleManager.isRoleSupervisor(NOTHING), false);
  //   });

  //   it("isWithdrawalManager()", async () => {
  //     assert.equal(await roleManager.isWithdrawalManager(NOTHING), false);

  //     await roleManager.grantRole(WITHDRAWAL_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.isWithdrawalManager(NOTHING), true);

  //     await roleManager.revokeRole(WITHDRAWAL_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.isWithdrawalManager(NOTHING), false);

  //     await roleManager.grantRole(WITHDRAWAL_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.isWithdrawalManager(NOTHING), true);

  //     await roleManager.renounceRole(WITHDRAWAL_MANAGER_ROLE, NOTHING, { from: NOTHING });
  //     assert.equal(await roleManager.isWithdrawalManager(NOTHING), false);
  //   });

  //   it("isMarketplaceManager()", async () => {
  //     assert.equal(await roleManager.isMarketplaceManager(NOTHING), false);

  //     await roleManager.grantRole(MARKETPLACE_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.isMarketplaceManager(NOTHING), true);

  //     await roleManager.revokeRole(MARKETPLACE_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.isMarketplaceManager(NOTHING), false);

  //     await roleManager.grantRole(MARKETPLACE_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.isMarketplaceManager(NOTHING), true);

  //     await roleManager.renounceRole(MARKETPLACE_MANAGER_ROLE, NOTHING, { from: NOTHING });
  //     assert.equal(await roleManager.isMarketplaceManager(NOTHING), false);
  //   });

  //   it("isSignatureManager", async () => {
  //     assert.equal(await roleManager.isSignatureManager(NOTHING), false);

  //     await roleManager.grantRole(SIGNATURE_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.isSignatureManager(NOTHING), true);

  //     await roleManager.revokeRole(SIGNATURE_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.isSignatureManager(NOTHING), false);

  //     await roleManager.grantRole(SIGNATURE_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.isSignatureManager(NOTHING), true);

  //     await roleManager.renounceRole(SIGNATURE_MANAGER_ROLE, NOTHING, { from: NOTHING });
  //     assert.equal(await roleManager.isSignatureManager(NOTHING), false);
  //   });
  // });

  // describe("grantRolesBatch()", async () => {
  //   beforeEach(async () => {
  //     await roleManager.__RoleManager_init();
  //     await roleManager.grantRole(ROLE_SUPERVISOR_ROLE, OWNER);
  //   });
  //   it("should grant roles", async () => {
  //     const users = [NOTHING, USER1];
  //     const roles = [TOKEN_FACTORY_MANAGER_ROLE, TOKEN_REGISTRY_MANAGER_ROLE];

  //     await roleManager.grantRolesBatch(roles, users);

  //     assert.equal(await roleManager.isTokenFactoryManager(NOTHING), true);
  //     assert.equal(await roleManager.isTokenRegistryManager(USER1), true);
  //   });

  //   it("should revert if roles and users length mismatch", async () => {
  //     const users = [NOTHING, USER1];
  //     const roles = [TOKEN_FACTORY_MANAGER_ROLE];

  //     await truffleAssert.reverts(
  //       roleManager.grantRolesBatch(roles, users),
  //       "RoleManager: roles and accounts arrays must be of equal length"
  //     );
  //   });
  // });

  // describe("hasAnyRole()", async () => {
  //   beforeEach(async () => {
  //     await roleManager.__RoleManager_init();
  //     await roleManager.grantRole(ROLE_SUPERVISOR_ROLE, OWNER);
  //   });

  //   it("should return true if user has any role", async () => {
  //     assert.equal(await roleManager.hasAnyRole(OWNER), true);

  //     assert.equal(await roleManager.hasAnyRole(NOTHING), false);
  //     await roleManager.grantRole(ADMINISTRATOR_ROLE, NOTHING);
  //     assert.equal(await roleManager.hasAnyRole(NOTHING), true);
  //     await roleManager.revokeRole(ADMINISTRATOR_ROLE, NOTHING);

  //     assert.equal(await roleManager.hasAnyRole(NOTHING), false);
  //     await roleManager.grantRole(TOKEN_FACTORY_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.hasAnyRole(NOTHING), true);
  //     await roleManager.revokeRole(TOKEN_FACTORY_MANAGER_ROLE, NOTHING);

  //     assert.equal(await roleManager.hasAnyRole(NOTHING), false);
  //     await roleManager.grantRole(TOKEN_REGISTRY_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.hasAnyRole(NOTHING), true);
  //     await roleManager.revokeRole(TOKEN_REGISTRY_MANAGER_ROLE, NOTHING);

  //     assert.equal(await roleManager.hasAnyRole(NOTHING), false);
  //     await roleManager.grantRole(TOKEN_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.hasAnyRole(NOTHING), true);
  //     await roleManager.revokeRole(TOKEN_MANAGER_ROLE, NOTHING);

  //     assert.equal(await roleManager.hasAnyRole(NOTHING), false);
  //     await roleManager.grantRole(ROLE_SUPERVISOR_ROLE, NOTHING);
  //     assert.equal(await roleManager.hasAnyRole(NOTHING), true);
  //     await roleManager.revokeRole(ROLE_SUPERVISOR_ROLE, NOTHING);

  //     assert.equal(await roleManager.hasAnyRole(NOTHING), false);
  //     await roleManager.grantRole(WITHDRAWAL_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.hasAnyRole(NOTHING), true);
  //     await roleManager.revokeRole(WITHDRAWAL_MANAGER_ROLE, NOTHING);

  //     assert.equal(await roleManager.hasAnyRole(NOTHING), false);
  //     await roleManager.grantRole(MARKETPLACE_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.hasAnyRole(NOTHING), true);
  //     await roleManager.revokeRole(MARKETPLACE_MANAGER_ROLE, NOTHING);

  //     assert.equal(await roleManager.hasAnyRole(NOTHING), false);
  //     await roleManager.grantRole(SIGNATURE_MANAGER_ROLE, NOTHING);
  //     assert.equal(await roleManager.hasAnyRole(NOTHING), true);
  //     await roleManager.revokeRole(SIGNATURE_MANAGER_ROLE, NOTHING);
  //   });

  //   it("should return false if user has no roles", async () => {
  //     assert.equal(await roleManager.hasAnyRole(NOTHING), false);
  //   });
  // });

  // describe("hasSpecificOrStrongerRoles()", async () => {
  //   it("should return true if user has any roles", async () => {
  //     await roleManager.__RoleManager_init();
  //     assert.equal(
  //       await roleManager.hasSpecificOrStrongerRoles([ADMINISTRATOR_ROLE, SIGNATURE_MANAGER_ROLE], OWNER),
  //       true
  //     );
  //     assert.equal(
  //       await roleManager.hasSpecificOrStrongerRoles([ROLE_SUPERVISOR_ROLE, SIGNATURE_MANAGER_ROLE], OWNER),
  //       true
  //     );

  //     assert.equal(
  //       await roleManager.hasSpecificOrStrongerRoles([ROLE_SUPERVISOR_ROLE, SIGNATURE_MANAGER_ROLE], NOTHING),
  //       false
  //     );
  //     await roleManager.grantRole(SIGNATURE_MANAGER_ROLE, NOTHING);
  //     assert.equal(
  //       await roleManager.hasSpecificOrStrongerRoles([ROLE_SUPERVISOR_ROLE, SIGNATURE_MANAGER_ROLE], NOTHING),
  //       true
  //     );
  //   });
  // });
});
