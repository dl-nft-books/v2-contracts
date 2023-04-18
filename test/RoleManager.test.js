const { assert } = require("chai");
const { accounts } = require("../scripts/utils/utils");
const { ZERO_BYTES } = require("../scripts/utils/constants");
const { parseConfig } = require("../deploy/helpers/deployHelper");
const { web3 } = require("hardhat");

const Reverter = require("./helpers/reverter");
const truffleAssert = require("truffle-assertions");

const ContractsRegistry = artifacts.require("ContractsRegistry");
const TokenFactory = artifacts.require("TokenFactory");
const TokenRegistry = artifacts.require("TokenRegistry");
const RoleManager = artifacts.require("RoleManager");
const Marketplace = artifacts.require("Marketplace");

describe("RoleManager", () => {
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

    roleManager = await RoleManager.at(await contractsRegistry.getRoleManagerContract());

    const config = parseConfig("./test/data/config.test.json");
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

  describe("modifiers check", () => {
    it("should get exception if try to call init function twice", async () => {
      const reason = "Initializable: contract is already initialized";

      await truffleAssert.reverts(
        roleManager.__RoleManager_init([[ZERO_BYTES, ZERO_BYTES, "New Default Admin"]]),
        reason
      );
    });

    it("should get exception if non dependecie injector try to call function", async () => {
      const reason = "Dependant: not an injector";

      await truffleAssert.reverts(roleManager.setDependencies(contractsRegistry.address, "0x0"), reason);
    });
  });

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

      assert.equal(roleInfo.baseRoleData.roleName, "New role");
      assert.equal(roleInfo.baseRoleData.role, newRole);
      assert.equal(roleInfo.baseRoleData.roleAdmin, ROLE_SUPERVISOR_ROLE);
      assert.deepEqual(roleInfo.members, [USER2]);
    });

    it("should correctly change already existing role", async () => {
      const newRoles = [[newRole, ROLE_SUPERVISOR_ROLE, "New role"]];

      await roleManager.updateRolesParams(newRoles);

      const changedRoleParams = [[newRole, ADMINISTRATOR_ROLE, "Changed role name"]];

      await roleManager.updateRolesParams(changedRoleParams);

      const roleInfo = (await roleManager.getRolesDetailedInfo([newRole]))[0];

      assert.equal(roleInfo.baseRoleData.roleName, "Changed role name");
      assert.equal(roleInfo.baseRoleData.role, newRole);
      assert.equal(roleInfo.baseRoleData.roleAdmin, ADMINISTRATOR_ROLE);
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
      assert.equal(roleInfo.baseRoleData.roleName, "");
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

  describe("specific check functions", () => {
    it("isAdmin", async () => {
      assert.isTrue(await roleManager.isAdmin(OWNER));
    });

    it("isTokenFactoryManager", async () => {
      assert.isFalse(await roleManager.isTokenFactoryManager(USER2));

      await roleManager.grantRole(TOKEN_FACTORY_MANAGER_ROLE, USER2);

      assert.isTrue(await roleManager.isTokenFactoryManager(USER2));
    });

    it("isTokenRegistryManager", async () => {
      assert.isFalse(await roleManager.isTokenRegistryManager(USER2));

      await roleManager.grantRole(TOKEN_REGISTRY_MANAGER_ROLE, USER2);

      assert.isTrue(await roleManager.isTokenRegistryManager(USER2));
    });

    it("isTokenManager", async () => {
      assert.isFalse(await roleManager.isTokenManager(USER2));

      await roleManager.grantRole(TOKEN_MANAGER_ROLE, USER2);

      assert.isTrue(await roleManager.isTokenManager(USER2));
    });

    it("isRoleSupervisor", async () => {
      assert.isFalse(await roleManager.isRoleSupervisor(USER2));

      await roleManager.grantRole(ROLE_SUPERVISOR_ROLE, USER2);

      assert.isTrue(await roleManager.isRoleSupervisor(USER2));
    });

    it("isWithdrawalManager", async () => {
      assert.isFalse(await roleManager.isWithdrawalManager(USER2));

      await roleManager.grantRole(WITHDRAWAL_MANAGER_ROLE, USER2);

      assert.isTrue(await roleManager.isWithdrawalManager(USER2));
    });

    it("isMarketplaceManager", async () => {
      assert.isFalse(await roleManager.isMarketplaceManager(USER2));

      await roleManager.grantRole(MARKETPLACE_MANAGER_ROLE, USER2);

      assert.isTrue(await roleManager.isMarketplaceManager(USER2));
    });

    it("isSignatureManager", async () => {
      assert.isFalse(await roleManager.isSignatureManager(USER2));

      await roleManager.grantRole(SIGNATURE_MANAGER_ROLE, USER2);

      assert.isTrue(await roleManager.isSignatureManager(USER2));
    });
  });

  describe("getUserRoles", () => {
    it("should return correct user roles arr", async () => {
      await roleManager.grantRole(ROLE_SUPERVISOR_ROLE, USER1);

      assert.deepEqual(await roleManager.getUserRoles(USER1), [ROLE_SUPERVISOR_ROLE]);

      await roleManager.grantRolesBatch([MARKETPLACE_MANAGER_ROLE, SIGNATURE_MANAGER_ROLE], [[USER1, USER2], [USER2]], {
        from: USER1,
      });

      assert.deepEqual(await roleManager.getUserRoles(USER1), [ROLE_SUPERVISOR_ROLE, MARKETPLACE_MANAGER_ROLE]);
      assert.deepEqual(await roleManager.getUserRoles(USER2), [MARKETPLACE_MANAGER_ROLE, SIGNATURE_MANAGER_ROLE]);

      await roleManager.revokeRoles(MARKETPLACE_MANAGER_ROLE, [USER2, USER1]);
      await roleManager.revokeRoles(SIGNATURE_MANAGER_ROLE, [USER2]);

      assert.deepEqual(await roleManager.getUserRoles(USER1), [ROLE_SUPERVISOR_ROLE]);
      assert.deepEqual(await roleManager.getUserRoles(USER2), []);
    });
  });

  describe("hasAnyRole", () => {
    it("should return true if user has any role", async () => {
      assert.isFalse(await roleManager.hasAnyRole(USER1));

      await roleManager.grantRole(MARKETPLACE_MANAGER_ROLE, USER1);
      await roleManager.grantRole(SIGNATURE_MANAGER_ROLE, USER1);
      await roleManager.grantRole(TOKEN_FACTORY_MANAGER_ROLE, USER2);

      assert.isTrue(await roleManager.hasAnyRole(USER1));
      assert.isTrue(await roleManager.hasAnyRole(USER2));
    });
  });

  describe("getAllRolesBaseInfo/getRolesBaseInfoPart/getRolesBaseInfo", () => {
    let rolesInitData;
    let newRoleManager;

    beforeEach("setup", async () => {
      newRoleManager = await RoleManager.new();

      rolesInitData = [
        {
          role: ZERO_BYTES,
          roleAdmin: ZERO_BYTES,
          roleName: "Default admin",
        },
        {
          role: ADMINISTRATOR_ROLE,
          roleAdmin: ADMINISTRATOR_ROLE,
          roleName: "Administrator",
        },
        {
          role: MARKETPLACE_MANAGER_ROLE,
          roleAdmin: ADMINISTRATOR_ROLE,
          roleName: "Marketplace manager",
        },
      ];

      await newRoleManager.__RoleManager_init(rolesInitData);

      assert.equal(await newRoleManager.getSupportedRolesCount(), 3);
      assert.deepEqual(await newRoleManager.getAllSupportedRoles(), [
        ZERO_BYTES,
        ADMINISTRATOR_ROLE,
        MARKETPLACE_MANAGER_ROLE,
      ]);
    });

    it("should correctly return base roles info for all roles", async () => {
      const result = await newRoleManager.getAllRolesBaseInfo();

      assert.equal(result.length, 3);

      result.forEach((el, index) => {
        const expectedRoleInitData = rolesInitData[index];

        assert.equal(el.role, expectedRoleInitData.role);
        assert.equal(el.roleAdmin, expectedRoleInitData.roleAdmin);
        assert.equal(el.roleName, expectedRoleInitData.roleName);
      });
    });

    it("should correctly return base roles info for part of the roles", async () => {
      const result = await newRoleManager.getRolesBaseInfoPart(1, 4);

      assert.equal(result.length, 2);

      result.forEach((el, index) => {
        const expectedRoleInitData = rolesInitData[index + 1];

        assert.equal(el.role, expectedRoleInitData.role);
        assert.equal(el.roleAdmin, expectedRoleInitData.roleAdmin);
        assert.equal(el.roleName, expectedRoleInitData.roleName);
      });
    });

    it("should correctly return base roles info for specific roles", async () => {
      const result = await newRoleManager.getRolesBaseInfo([ZERO_BYTES, MARKETPLACE_MANAGER_ROLE]);

      assert.equal(result.length, 2);

      const indexes = [0, 2];

      result.forEach((el, index) => {
        const expectedRoleInitData = rolesInitData[indexes[index]];

        assert.equal(el.role, expectedRoleInitData.role);
        assert.equal(el.roleAdmin, expectedRoleInitData.roleAdmin);
        assert.equal(el.roleName, expectedRoleInitData.roleName);
      });
    });
  });

  describe("getAllRolesDetailedInfo/getRolesDetailedInfoPart/getRolesDetailedInfo", () => {
    let rolesInitData;
    let newRoleManager;
    let members;

    beforeEach("setup", async () => {
      newRoleManager = await RoleManager.new();

      rolesInitData = [
        {
          role: ZERO_BYTES,
          roleAdmin: ZERO_BYTES,
          roleName: "Default admin",
        },
        {
          role: ADMINISTRATOR_ROLE,
          roleAdmin: ADMINISTRATOR_ROLE,
          roleName: "Administrator",
        },
        {
          role: MARKETPLACE_MANAGER_ROLE,
          roleAdmin: ADMINISTRATOR_ROLE,
          roleName: "Marketplace manager",
        },
      ];
      members = [[OWNER], [OWNER, USER1], [USER2, USER1]];

      await newRoleManager.__RoleManager_init(rolesInitData);

      assert.equal(await newRoleManager.getSupportedRolesCount(), 3);
      assert.deepEqual(await newRoleManager.getAllSupportedRoles(), [
        ZERO_BYTES,
        ADMINISTRATOR_ROLE,
        MARKETPLACE_MANAGER_ROLE,
      ]);

      await newRoleManager.grantRolesBatch([ADMINISTRATOR_ROLE, MARKETPLACE_MANAGER_ROLE], [[USER1], [USER2, USER1]]);
    });

    it("should correctly return detailed roles info for all roles", async () => {
      const result = await newRoleManager.getAllRolesDetailedInfo();

      assert.equal(result.length, 3);

      result.forEach((el, index) => {
        const expectedRoleInitData = rolesInitData[index];

        assert.equal(el.baseRoleData.role, expectedRoleInitData.role);
        assert.equal(el.baseRoleData.roleAdmin, expectedRoleInitData.roleAdmin);
        assert.equal(el.baseRoleData.roleName, expectedRoleInitData.roleName);
        assert.deepEqual(el.members, members[index]);
      });
    });

    it("should correctly return detailed roles info for part of the roles", async () => {
      const result = await newRoleManager.getRolesDetailedInfoPart(1, 4);

      assert.equal(result.length, 2);

      result.forEach((el, index) => {
        const expectedRoleInitData = rolesInitData[index + 1];

        assert.equal(el.baseRoleData.role, expectedRoleInitData.role);
        assert.equal(el.baseRoleData.roleAdmin, expectedRoleInitData.roleAdmin);
        assert.equal(el.baseRoleData.roleName, expectedRoleInitData.roleName);
        assert.deepEqual(el.members, members[index + 1]);
      });
    });

    it("should correctly return detailed roles info for specific roles", async () => {
      const result = await newRoleManager.getRolesDetailedInfo([ZERO_BYTES, MARKETPLACE_MANAGER_ROLE]);

      assert.equal(result.length, 2);

      const indexes = [0, 2];

      result.forEach((el, index) => {
        const expectedRoleInitData = rolesInitData[indexes[index]];

        assert.equal(el.baseRoleData.role, expectedRoleInitData.role);
        assert.equal(el.baseRoleData.roleAdmin, expectedRoleInitData.roleAdmin);
        assert.equal(el.baseRoleData.roleName, expectedRoleInitData.roleName);
        assert.deepEqual(el.members, members[indexes[index]]);
      });
    });
  });

  describe("hasSpecificRoles", () => {
    it("should return true if the user has minimum one of the passed roles", async () => {
      await roleManager.grantRoles(MARKETPLACE_MANAGER_ROLE, [USER1, USER2]);
      await roleManager.grantRoles(WITHDRAWAL_MANAGER_ROLE, [USER2]);

      assert.isFalse(await roleManager.hasSpecificRoles([ADMINISTRATOR_ROLE], USER1));
      assert.isFalse(
        await roleManager.hasSpecificRoles([TOKEN_FACTORY_MANAGER_ROLE, TOKEN_REGISTRY_MANAGER_ROLE], USER1)
      );

      assert.isTrue(await roleManager.hasSpecificRoles([ADMINISTRATOR_ROLE, MARKETPLACE_MANAGER_ROLE], USER1));
      assert.isTrue(await roleManager.hasSpecificRoles([WITHDRAWAL_MANAGER_ROLE, MARKETPLACE_MANAGER_ROLE], USER2));
    });
  });

  describe("hasRole", () => {
    it("should return true for ADMINISTRATOR", async () => {
      assert.isTrue(await roleManager.hasRole(MARKETPLACE_MANAGER_ROLE, OWNER));
      assert.isTrue(await roleManager.hasRole(WITHDRAWAL_MANAGER_ROLE, OWNER));
      assert.isTrue(await roleManager.hasRole(SIGNATURE_MANAGER_ROLE, OWNER));
    });

    it("should return true if user has specific role", async () => {
      assert.isFalse(await roleManager.hasRole(MARKETPLACE_MANAGER_ROLE, USER1));

      await roleManager.grantRole(MARKETPLACE_MANAGER_ROLE, USER1);

      assert.isTrue(await roleManager.hasRole(MARKETPLACE_MANAGER_ROLE, USER1));
    });

    it("should return false if admin removed role", async () => {
      await roleManager.grantRole(MARKETPLACE_MANAGER_ROLE, USER1);

      assert.isTrue(await roleManager.hasRole(MARKETPLACE_MANAGER_ROLE, USER1));

      await roleManager.removeRoles([MARKETPLACE_MANAGER_ROLE]);

      assert.isFalse(await roleManager.hasRole(MARKETPLACE_MANAGER_ROLE, USER1));
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
