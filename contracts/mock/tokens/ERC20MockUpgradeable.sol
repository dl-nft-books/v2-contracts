// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract ERC20MockUpgradeable is ERC20Upgradeable {
    uint8 internal _decimals;

    function __ERC20Mock_init(
        string memory name_,
        string memory symbol_,
        uint8 decimalPlaces_
    ) internal initializer {
        __ERC20_init(name_, symbol_);

        _decimals = decimalPlaces_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to_, uint256 amount_) public {
        _mint(to_, amount_);
    }

    function burn(address to_, uint256 amount_) public {
        _burn(to_, amount_);
    }
}
