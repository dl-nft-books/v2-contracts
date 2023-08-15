// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@solarity/solidity-lib/contracts-registry/AbstractDependant.sol";

import "../interfaces/IContractsRegistry.sol";

contract Pool is AbstractDependant {
    address public roleManager;

    function setDependencies(address contractsRegistry_, bytes memory) public override dependant {
        roleManager = IContractsRegistry(contractsRegistry_).getRoleManagerContract();
    }
}
