// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@dlsl/dev-modules/contracts-registry/pools/pool-factory/AbstractPoolFactory.sol";

import "./interfaces/ITokenFactory.sol";
import "./interfaces/IContractsRegistry.sol";
import "./interfaces/ITokenRegistry.sol";
import "./interfaces/IRoleManager.sol";
import "./interfaces/IMarketplace.sol";
import "./interfaces/tokens/IERC721MintableToken.sol";

contract TokenFactory is ITokenFactory, AbstractPoolFactory {
    address internal _tokenRegistry;
    address internal _marketplace;
    IRoleManager internal _roleManager;
    
    string private _tokenBaseUri;

    modifier onlyTokenFactoryManager() {
        _onlyTokenFactoryManager();
        _;
    }

    modifier onlyMarketplace() {
        _onlyMarketplace();
        _;
    }

    function setDependencies(address contractsRegistry_, bytes calldata data_) public override {
        super.setDependencies(contractsRegistry_, data_);

        IContractsRegistry registry = IContractsRegistry(contractsRegistry_);

        _tokenRegistry = registry.getTokenRegistryContract();
        _marketplace = registry.getMarketplaceContract();
        _roleManager = IRoleManager(registry.getRoleManagerContract());
    }

    function setTokenBaseUri(string memory tokenBaseUri_) public override onlyTokenFactoryManager {
        _tokenBaseUri = tokenBaseUri_;
    }

    function deployToken(
        string calldata name_,
        string calldata symbol_
    ) external override onlyMarketplace returns (address tokenProxy) {
        tokenProxy = _deploy();

        _initTokenPool(tokenProxy, name_, symbol_);

        _register(tokenProxy);
        _injectDependencies(tokenProxy);

        emit TokenDeployed(name_, symbol_, tokenProxy);
    }

    function _initTokenPool(
        address tokenProxy_,
        string calldata name_,
        string calldata symbol_
    ) internal {
        IERC721MintableToken(tokenProxy_).__ERC721MintableToken_init();
        // IERC721MintableToken.ERC721MintableTokenInitParams(name_, symbol_, pricePerOneToken_)
    }

    function _deploy() internal returns (address) {
        return _deploy(_tokenRegistry, ITokenRegistry(_tokenRegistry).TOKEN_POOL());
    }

    function _register(address poolProxy_) internal {
        _register(_tokenRegistry, ITokenRegistry(_tokenRegistry).TOKEN_POOL(), poolProxy_);
    }

    function _injectDependencies(address proxy_) internal {
        _injectDependencies(_tokenRegistry, proxy_);
    }

    function getTokenBaseUri() public view override returns (string memory) {
        return _tokenBaseUri;
    }

    function _onlyTokenFactoryManager() internal view {
        require(
            _roleManager.isTokenFactoryManager(msg.sender),
            "TokenFactory: Caller is not a token factory manager"
        );
    }

    function _onlyMarketplace() internal view {
        require(_marketplace == msg.sender, "TokenFactory: Caller is not a marketplace");
    }
}
