// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@dlsl/dev-modules/contracts-registry/pools/pool-factory/AbstractPoolFactory.sol";

import "./interfaces/IContractsRegistry.sol";
import "./interfaces/ITokenRegistry.sol";
import "./interfaces/ITokenFactory.sol";
import "./interfaces/IRoleManager.sol";
import "./interfaces/tokens/IERC721MintableToken.sol";

contract TokenFactory is ITokenFactory, AbstractPoolFactory {
    address internal _tokenRegistry;
    address internal _marketplace;
    IRoleManager internal _roleManager;

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

    function deployToken(
        string calldata name_,
        string calldata symbol_
    ) external override onlyMarketplace returns (address tokenProxy_) {
        string memory tokenPool_ = ITokenRegistry(_tokenRegistry).TOKEN_POOL();
        tokenProxy_ = _deploy(_tokenRegistry, tokenPool_);

        IERC721MintableToken(tokenProxy_).__ERC721MintableToken_init(name_, symbol_);

        _register(_tokenRegistry, tokenPool_, tokenProxy_);
        _injectDependencies(_tokenRegistry, tokenProxy_);
    }

    function _onlyMarketplace() internal view {
        require(_marketplace == msg.sender, "TokenFactory: Caller is not a marketplace");
    }
}
