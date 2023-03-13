// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";

contract ERC20Mock is ERC20PermitUpgradeable {
    uint8 internal _decimals;

    function __ERC20Mock_init(
        string memory name_,
        string memory symbol_,
        uint8 decimalPlaces_
    ) internal initializer {
        __ERC20_init(name_, symbol_);
        __ERC20Permit_init(name_);

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
