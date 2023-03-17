// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@dlsl/dev-modules/contracts-registry/AbstractDependant.sol";

import "../interfaces/IContractsRegistry.sol";

contract Pool is AbstractDependant {
    address public roleManager;

    function setDependencies(
        address contractsRegistry_,
        bytes calldata
    ) external override dependant {
        roleManager = IContractsRegistry(contractsRegistry_).getRoleManagerContract();
    }
}