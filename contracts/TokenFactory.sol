// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.18;

import "@dlsl/dev-modules/contracts-registry/pools/pool-factory/AbstractPoolFactory.sol";

import "./interfaces/IContractsRegistry.sol";
import "./interfaces/ITokenRegistry.sol";
import "./interfaces/ITokenFactory.sol";
import "./interfaces/IRoleManager.sol";
import "./interfaces/tokens/IERC721MintableToken.sol";
import "./interfaces/tokens/IVoucher.sol";

contract TokenFactory is ITokenFactory, AbstractPoolFactory {
    address internal _tokenRegistry;
    address internal _marketplace;
    IRoleManager internal _roleManager;

    modifier onlyMarketplace() {
        _onlyMarketplace();
        _;
    }

    modifier onlyEligibleAddresses() {
        _onlyEligibleAddresses();
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
        tokenProxy_ = _deployToken(ITokenRegistry(_tokenRegistry).TOKEN_CONTRACT());

        IERC721MintableToken(tokenProxy_).__ERC721MintableToken_init(name_, symbol_);
    }

    function deployVoucher(
        string calldata name_,
        string calldata symbol_
    ) external override onlyEligibleAddresses returns (address voucherProxy_) {
        voucherProxy_ = _deployToken(ITokenRegistry(_tokenRegistry).VOUCHER_TOKEN());

        IVoucher(voucherProxy_).__Voucher_init(name_, symbol_);
    }

    function _deployToken(string memory tokenType_) internal returns (address tokenProxy_) {
        tokenProxy_ = _deploy(_tokenRegistry, tokenType_);

        _register(_tokenRegistry, tokenType_, tokenProxy_);
        _injectDependencies(_tokenRegistry, tokenProxy_);

        emit TokenDeployed(tokenProxy_);
    }

    function _onlyMarketplace() internal view {
        require(_marketplace == msg.sender, "TokenFactory: Caller is not a marketplace.");
    }

    function _onlyEligibleAddresses() internal view {
        require(
            _marketplace == msg.sender || _roleManager.isTokenFactoryManager(msg.sender),
            "TokenFactory: Caller is not a marketplace or token factory manager."
        );
    }
}
