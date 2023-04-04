// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@dlsl/dev-modules/contracts-registry/AbstractDependant.sol";

import "../interfaces/IContractsRegistry.sol";
import "../interfaces/IRoleManager.sol";

contract Voucher is ERC20PermitUpgradeable, AbstractDependant{
    IRoleManager internal _roleManager;

    modifier onlyTokenManager() {
        _onlyTokenManager();
        _;
    }

    function __Voucher_init(string memory name, string memory symbol) public initializer {
        __ERC20_init(name, symbol);
        __ERC20Permit_init(name);
    }

    function setDependencies(
        address contractsRegistry_,
        bytes calldata
    ) external override dependant {
        IContractsRegistry registry_ = IContractsRegistry(contractsRegistry_);

        _roleManager = IRoleManager(registry_.getRoleManagerContract());
    }

    function mint(address to, uint256 amount) public onlyTokenManager {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) public onlyTokenManager {
        _burn(from, amount);
    }

    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) public override {
        super.permit(owner, spender, value, deadline, v, r, s);
    }

    function _onlyTokenManager() internal view {
        require(_roleManager.isTokenManager(msg.sender), "Voucher: Caller is not an token manager.");
    }
}