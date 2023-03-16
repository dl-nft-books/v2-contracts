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
    string private _tokenBaseUri;

    ITokenRegistry internal _tokenRegistry;
    IRoleManager internal _roleManager;
    IMarketplace internal _marketplace;

    modifier onlyAdministrator() {
        _onlyAdministrator();
        _;
    }

    modifier onlyMarketplace() {
        _onlyMarketplace();
        _;
    }

    function setDependencies(address contractsRegistry_, bytes calldata data_) public override {
        super.setDependencies(contractsRegistry_, data_);

        IContractsRegistry registry = IContractsRegistry(contractsRegistry_);
        _tokenRegistry = ITokenRegistry(registry.getTokenRegistryContract());
        _roleManager = IRoleManager(registry.getRoleManagerContract());
        _marketplace = IMarketplace(registry.getMarketplaceContract());
    }

    function getTokenBaseUri() public view override returns (string memory) {
        return _tokenBaseUri;
    }

    function setTokenBaseUri(string memory tokenBaseUri_) public override onlyAdministrator {
        _tokenBaseUri = tokenBaseUri_;
    }

    function deployToken(
        string calldata name_,
        string calldata symbol_,
        uint256 pricePerOneToken_
    ) external override onlyMarketplace {
        address tokenProxy = _deploy();

        _initTokenPool(tokenProxy, name_, symbol_, pricePerOneToken_);

        _register(tokenProxy);
        _injectDependencies(tokenProxy);

        emit TokenDeployed(name_, symbol_, tokenProxy);
    }

    function _initTokenPool(
        address tokenProxy_,
        string calldata name_,
        string calldata symbol_,
        uint256 pricePerOneToken_
    ) internal {
        IERC721MintableToken(tokenProxy_).__ERC721MintableToken_init(
            IERC721MintableToken.ERC721MintableTokenInitParams(name_, symbol_, pricePerOneToken_)
        );
    }

    function _deploy() internal returns (address) {
        return _deploy(address(_tokenRegistry), _tokenRegistry.TOKEN_POOL());
    }

    function _register(address poolProxy_) internal {
        _register(address(_tokenRegistry), _tokenRegistry.TOKEN_POOL(), poolProxy_);
    }

    function _injectDependencies(address proxy_) internal {
        _injectDependencies(address(_tokenRegistry), proxy_);
    }

    function _onlyAdministrator() internal view {
        require(
            IRoleManager(_roleManager).isAdmin(msg.sender),
            "TokenFactory: Caller is not an administrator"
        );
    }

    function _onlyMarketplace() internal view {
        require(address(_marketplace) == msg.sender, "TokenFactory: Caller is not a marketplace");
    }
}
