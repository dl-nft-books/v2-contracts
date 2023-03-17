// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@dlsl/dev-modules/contracts-registry/pools/AbstractPoolContractsRegistry.sol";

import "./interfaces/ITokenRegistry.sol";
import "./interfaces/IContractsRegistry.sol";
import "./interfaces/IRoleManager.sol";

contract TokenRegistry is ITokenRegistry, AbstractPoolContractsRegistry {
    using EnumerableSet for EnumerableSet.AddressSet;

    string public constant TOKEN_POOL = "TOKEN_POOL";

    address internal _tokenFactory;
    address internal _roleManager;

    modifier onlyTokenFactory() {
        _onlyTokenFactory();
        _;
    }

    modifier onlyTokenRegistryManager() {
        _onlyTokenRegistryManager();
        _;
    }

    function setNewImplementations(
        string[] calldata names_,
        address[] calldata newImplementations_
    ) external onlyTokenRegistryManager {
        _setNewImplementations(names_, newImplementations_);
    }

    function injectDependenciesToExistingPools(
        uint256 offset_,
        uint256 limit_
    ) external onlyTokenRegistryManager {
        _injectDependenciesToExistingPools(TOKEN_POOL, offset_, limit_);
    }

    function injectDependenciesToExistingPoolsWithData(
        bytes calldata data_,
        uint256 offset_,
        uint256 limit_
    ) external onlyTokenRegistryManager {
        _injectDependenciesToExistingPoolsWithData(TOKEN_POOL, data_, offset_, limit_);
    }

    function setDependencies(address contractsRegistry, bytes calldata data) public override {
        super.setDependencies(contractsRegistry, data);

        _tokenFactory = IContractsRegistry(contractsRegistry).getTokenFactoryContract();
        _roleManager = IContractsRegistry(contractsRegistry).getRoleManagerContract();
    }

    function addProxyPool(
        string calldata poolName,
        address tokenAddress
    ) external override onlyTokenFactory {
        _addProxyPool(poolName, tokenAddress);
    }

    function isTokenPool(address potentialPool) public view override returns (bool) {
        return _pools[TOKEN_POOL].contains(potentialPool);
    }

    function _onlyTokenFactory() internal view {
        require(_tokenFactory == msg.sender, "TokenRegistry: Caller is not a factory");
    }

    function _onlyTokenRegistryManager() internal view {
        require(
            IRoleManager(_roleManager).isTokenRegistryManager(msg.sender),
            "TokenRegistry: Caller is not a token registry manager"
        );
    }
}
