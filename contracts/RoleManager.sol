// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "@dlsl/dev-modules/contracts-registry/AbstractDependant.sol";

import "./interfaces/IContractsRegistry.sol";

contract RoleManager is AccessControlUpgradeable, AbstractDependant {
    bytes32 public constant ADMINISTATOR_ROLE = keccak256("ADMINISTATOR_ROLE");

    function __RoleManager_init() external initializer {
        __AccessControl_init();

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        grantRole(ADMINISTATOR_ROLE, msg.sender);
    }

    function setDependencies(address contractsRegistry_, bytes calldata data_) public override {
    }

    function addAdmin(address admin_) public {
        grantRole(ADMINISTATOR_ROLE, admin_);
    }

    function removeAdmin(address admin_) public {
        revokeRole(ADMINISTATOR_ROLE, admin_);
    }

    function isAdmin(address admin_) public view returns (bool) {
        return hasRole(ADMINISTATOR_ROLE, admin_);
    }
}
