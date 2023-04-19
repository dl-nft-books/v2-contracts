// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@dlsl/dev-modules/contracts-registry/AbstractDependant.sol";

import "../interfaces/IContractsRegistry.sol";
import "../interfaces/IRoleManager.sol";
import "../interfaces/tokens/IVoucher.sol";

contract Voucher is IVoucher, ERC20PermitUpgradeable, AbstractDependant {
    IRoleManager internal _roleManager;

    modifier onlyTokenManager() {
        _onlyTokenManager();
        _;
    }

    function __Voucher_init(
        string memory name_,
        string memory symbol_
    ) public override initializer {
        __ERC20_init(name_, symbol_);
        __ERC20Permit_init("Voucher");
    }

    function setDependencies(
        address contractsRegistry_,
        bytes calldata
    ) external override dependant {
        IContractsRegistry registry_ = IContractsRegistry(contractsRegistry_);

        _roleManager = IRoleManager(registry_.getRoleManagerContract());
    }

    function mint(address to_, uint256 amount_) public override onlyTokenManager {
        _mint(to_, amount_);
    }

    function burn(address from_, uint256 amount_) public override onlyTokenManager {
        _burn(from_, amount_);
    }

    function _onlyTokenManager() internal view {
        require(
            _roleManager.isTokenManager(msg.sender),
            "Voucher: Caller is not an token manager."
        );
    }
}
