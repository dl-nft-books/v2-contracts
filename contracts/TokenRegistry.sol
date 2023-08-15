// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "@solarity/solidity-lib/contracts-registry/pools/AbstractPoolContractsRegistry.sol";

import "./interfaces/IContractsRegistry.sol";
import "./interfaces/ITokenRegistry.sol";
import "./interfaces/IMarketplace.sol";
import "./interfaces/IRoleManager.sol";

contract TokenRegistry is ITokenRegistry, AbstractPoolContractsRegistry {
    using EnumerableSet for EnumerableSet.AddressSet;

    string public constant override TOKEN_CONTRACT = "TOKEN_CONTRACT";
    string public constant override VOUCHER_TOKEN = "VOUCHER_TOKEN";

    address internal _tokenFactory;
    IRoleManager internal _roleManager;

    modifier onlyTokenFactory() {
        _onlyTokenFactory();
        _;
    }

    modifier onlyTokenRegistryManager() {
        _onlyTokenRegistryManager();
        _;
    }

    function setDependencies(address contractsRegistry_, bytes calldata data_) public override {
        super.setDependencies(contractsRegistry_, data_);

        IContractsRegistry registry_ = IContractsRegistry(contractsRegistry_);

        _tokenFactory = registry_.getTokenFactoryContract();
        _roleManager = IRoleManager(registry_.getRoleManagerContract());
    }

    function setNewImplementations(
        string[] calldata names_,
        address[] calldata newImplementations_
    ) external onlyTokenRegistryManager {
        _setNewImplementations(names_, newImplementations_);
    }

    function injectDependenciesToExistingPools(
        string calldata name_,
        uint256 offset_,
        uint256 limit_
    ) external onlyTokenRegistryManager {
        _injectDependenciesToExistingPools(name_, offset_, limit_);
    }

    function injectDependenciesToExistingPoolsWithData(
        string calldata name_,
        bytes calldata data_,
        uint256 offset_,
        uint256 limit_
    ) external onlyTokenRegistryManager {
        _injectDependenciesToExistingPoolsWithData(name_, data_, offset_, limit_);
    }

    function addProxyPool(
        string calldata poolName_,
        address tokenAddress_
    ) external override onlyTokenFactory {
        _addProxyPool(poolName_, tokenAddress_);
    }

    function isTokenContract(address potentialContract_) external view override returns (bool) {
        return _pools[TOKEN_CONTRACT].contains(potentialContract_);
    }

    function isVoucherToken(address potentialContract_) external view override returns (bool) {
        return _pools[VOUCHER_TOKEN].contains(potentialContract_);
    }

    function getBaseTokenDataPart(
        string calldata poolName_,
        uint256 offset_,
        uint256 limit_
    ) external view override returns (IMarketplace.BaseTokenData[] memory baseTokensData_) {
        address[] memory _contractsPart = listPools(poolName_, offset_, limit_);

        baseTokensData_ = new IMarketplace.BaseTokenData[](_contractsPart.length);
        for (uint256 i = 0; i < _contractsPart.length; i++) {
            IERC20Metadata contract_ = IERC20Metadata(_contractsPart[i]);
            baseTokensData_[i] = IMarketplace.BaseTokenData(
                _contractsPart[i],
                contract_.name(),
                contract_.symbol()
            );
        }
    }

    function _onlyTokenFactory() internal view {
        require(_tokenFactory == msg.sender, "TokenRegistry: Caller is not a factory.");
    }

    function _onlyTokenRegistryManager() internal view {
        require(
            _roleManager.isTokenRegistryManager(msg.sender),
            "TokenRegistry: Caller is not a token registry manager."
        );
    }
}
