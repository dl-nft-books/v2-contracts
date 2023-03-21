// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";

import "@dlsl/dev-modules/contracts-registry/AbstractDependant.sol";

import "./interfaces/IContractsRegistry.sol";
import "./interfaces/IRoleManager.sol";

contract RoleManager is IRoleManager, AccessControlEnumerableUpgradeable, AbstractDependant {
    bytes32 public constant override ADMINISTRATOR_ROLE = keccak256("ADMINISTRATOR_ROLE");
    bytes32 public constant override TOKEN_FACTORY_MANAGER = keccak256("TOKEN_FACTORY_MANAGER");
    bytes32 public constant override TOKEN_REGISTRY_MANAGER = keccak256("TOKEN_REGISTRY_MANAGER");
    bytes32 public constant override TOKEN_MANAGER = keccak256("TOKEN_MANAGER");
    bytes32 public constant override ROLE_SUPERVISOR = keccak256("ROLE_SUPERVISOR");
    bytes32 public constant override WITHDRAWAL_MANAGER = keccak256("WITHDRAWAL_MANAGER");
    bytes32 public constant override MARKETPLACE_MANAGER = keccak256("MARKETPLACE_MANAGER");

    function __RoleManager_init() external override initializer {
        __AccessControl_init();

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        grantRole(ADMINISTRATOR_ROLE, msg.sender);

        _setRoleAdmin(ADMINISTRATOR_ROLE, ADMINISTRATOR_ROLE);
        _setRoleAdmin(TOKEN_FACTORY_MANAGER, ROLE_SUPERVISOR);
        _setRoleAdmin(TOKEN_REGISTRY_MANAGER, ROLE_SUPERVISOR);
        _setRoleAdmin(TOKEN_MANAGER, ROLE_SUPERVISOR);
        _setRoleAdmin(ROLE_SUPERVISOR, ADMINISTRATOR_ROLE);
        _setRoleAdmin(WITHDRAWAL_MANAGER, ROLE_SUPERVISOR);
        _setRoleAdmin(MARKETPLACE_MANAGER, ROLE_SUPERVISOR);
    }

    function setDependencies(
        address contractsRegistry_,
        bytes calldata data_
    ) public override dependant {}

    function revokeRole(bytes32 role_, address account_) public override {
        require(
            role_ != ADMINISTRATOR_ROLE || getRoleMemberCount(ADMINISTRATOR_ROLE) > 1,
            "RoleManager: cannot revoke last administrator"
        );
        super.revokeRole(role_, account_);
    }

    function grantRoleBatch(
        bytes32[] calldata roles_,
        address[] calldata accounts_
    ) public override {
        require(
            roles_.length == accounts_.length,
            "RoleManager: roles and accounts arrays must be of equal length"
        );
        for (uint256 i = 0; i < roles_.length; i++) {
            grantRole(roles_[i], accounts_[i]);
        }
    }

    function isAdmin(address admin_) public view override returns (bool) {
        return hasRole(ADMINISTRATOR_ROLE, admin_);
    }

    function isTokenFactoryManager(address manager_) public view override returns (bool) {
        return hasRole(TOKEN_FACTORY_MANAGER, manager_) || hasRole(ADMINISTRATOR_ROLE, manager_);
    }

    function isTokenRegistryManager(address manager_) public view override returns (bool) {
        return hasRole(TOKEN_REGISTRY_MANAGER, manager_) || hasRole(ADMINISTRATOR_ROLE, manager_);
    }

    function isTokenManager(address manager_) public view override returns (bool) {
        return hasRole(TOKEN_MANAGER, manager_) || hasRole(ADMINISTRATOR_ROLE, manager_);
    }

    function isRoleSupervisor(address supervisor_) public view override returns (bool) {
        return hasRole(ROLE_SUPERVISOR, supervisor_) || hasRole(ADMINISTRATOR_ROLE, supervisor_);
    }

    function isWithdrawalManager(address manager_) public view override returns (bool) {
        return hasRole(WITHDRAWAL_MANAGER, manager_) || hasRole(ADMINISTRATOR_ROLE, manager_);
    }

    function isMarketplaceManager(address manager_) public view override returns (bool) {
        return hasRole(MARKETPLACE_MANAGER, manager_) || hasRole(ADMINISTRATOR_ROLE, manager_);
    }

    function hasAnyRole(address account_) public view override returns (bool) {
        return
            hasRole(ADMINISTRATOR_ROLE, account_) ||
            hasRole(TOKEN_FACTORY_MANAGER, account_) ||
            hasRole(TOKEN_REGISTRY_MANAGER, account_) ||
            hasRole(TOKEN_MANAGER, account_) ||
            hasRole(ROLE_SUPERVISOR, account_) ||
            hasRole(WITHDRAWAL_MANAGER, account_) ||
            hasRole(MARKETPLACE_MANAGER, account_);
    }
}
