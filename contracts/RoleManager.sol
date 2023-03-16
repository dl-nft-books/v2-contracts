// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";

import "@dlsl/dev-modules/contracts-registry/AbstractDependant.sol";

import "./interfaces/IContractsRegistry.sol";

contract RoleManager is AccessControlEnumerableUpgradeable, AbstractDependant {
    bytes32 public constant ADMINISTATOR_ROLE = keccak256("ADMINISTATOR_ROLE");
    bytes32 public constant TOKEN_FACTORY_MANAGER = keccak256("TOKEN_FACTORY_MANAGER");
    bytes32 public constant TOKEN_REGISTRY_MANAGER = keccak256("TOKEN_REGISTRY_MANAGER");
    bytes32 public constant TOKEN_MANAGER = keccak256("TOKEN_MANAGER");
    bytes32 public constant ROLE_SUPERVISOR = keccak256("ROLE_SUPERVISOR");
    bytes32 public constant WITHDRAWAL_MANAGER = keccak256("WITHDRAWAL_MANAGER");

    function __RoleManager_init() external initializer {
        __AccessControl_init();

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        _setRoleAdmin(ADMINISTATOR_ROLE, ROLE_SUPERVISOR);
        _setRoleAdmin(TOKEN_FACTORY_MANAGER, ROLE_SUPERVISOR);
        _setRoleAdmin(TOKEN_REGISTRY_MANAGER, ROLE_SUPERVISOR);
        _setRoleAdmin(TOKEN_MANAGER, ROLE_SUPERVISOR);
        _setRoleAdmin(WITHDRAWAL_MANAGER, ROLE_SUPERVISOR);

        grantRole(ROLE_SUPERVISOR, msg.sender);
        grantRole(ADMINISTATOR_ROLE, msg.sender);
    }

    function setDependencies(address contractsRegistry_, bytes calldata data_) public override dependant {}

    function isAdmin(address admin_) public view returns (bool) {
        return hasRole(ADMINISTATOR_ROLE, admin_);
    }

    function isTokenFactoryManager(address manager_) public view returns (bool) {
        return hasRole(TOKEN_FACTORY_MANAGER, manager_);
    }

    function isTokenRegistryManager(address manager_) public view returns (bool) {
        return hasRole(TOKEN_REGISTRY_MANAGER, manager_);
    }

    function isTokenManager(address manager_) public view returns (bool) {
        return hasRole(TOKEN_MANAGER, manager_);
    }

    function isRoleSupervisor(address supervisor_) public view returns (bool) {
        return hasRole(ROLE_SUPERVISOR, supervisor_);
    }

    function isWithdrawalManager(address manager_) public view returns (bool) {
        return hasRole(WITHDRAWAL_MANAGER, manager_);
    }
}
