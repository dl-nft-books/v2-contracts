// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/AccessControl.sol";

import "@dlsl/dev-modules/contracts-registry/AbstractDependant.sol";

import "./interfaces/IContractsRegistry.sol";

contract RoleManager is AccessControl, AbstractDependant {
    bytes32 public constant ADMINISTATOR_ROLE = keccak256("ADMINISTATOR_ROLE");

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        grantRole(ADMINISTATOR_ROLE, msg.sender);
    }

    function setDependencies(
        address contractsRegistry,
        bytes calldata
    ) external override dependant {
        // IContractsRegistry registry = IContractsRegistry(contractsRegistry);
    }

    function addAdmin(address _admin) public {
        grantRole(ADMINISTATOR_ROLE, _admin);
    }

    function removeAdmin(address _admin) public {
        revokeRole(ADMINISTATOR_ROLE, _admin);
    }

    function isAdmin(address _admin) public view returns (bool) {
        return hasRole(ADMINISTATOR_ROLE, _admin);
    }
}
