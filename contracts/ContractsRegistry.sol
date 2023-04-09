// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@dlsl/dev-modules/contracts-registry/presets/OwnableContractsRegistry.sol";

import "./interfaces/IContractsRegistry.sol";

contract ContractsRegistry is IContractsRegistry, OwnableContractsRegistry {
    string public constant override TOKEN_FACTORY_NAME = "TOKEN_FACTORY";
    string public constant override TOKEN_REGISTRY_NAME = "TOKEN_REGISTRY";

    string public constant override MARKETPLACE_NAME = "MARKETPLACE";

    string public constant override ROLE_MANAGER_NAME = "ROLE_MANAGER";

    function getTokenFactoryContract() external view override returns (address) {
        return getContract(TOKEN_FACTORY_NAME);
    }

    function getTokenRegistryContract() external view override returns (address) {
        return getContract(TOKEN_REGISTRY_NAME);
    }

    function getMarketplaceContract() external view override returns (address) {
        return getContract(MARKETPLACE_NAME);
    }

    function getRoleManagerContract() public view override returns (address) {
        return getContract(ROLE_MANAGER_NAME);
    }
}
