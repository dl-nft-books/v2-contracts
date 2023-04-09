// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./ERC20MockUpgradeable.sol";

contract ERC20MockUpgradeableUpgraded is ERC20Upgradeable {
    uint256 public importantVariable;

    function __ERC20Mock_init(
        string memory name_,
        string memory symbol_,
        uint8 decimalPlaces_
    ) internal initializer {
        __ERC20Mock_init(name_, symbol_, decimalPlaces_);
    }

    function doUpgrade(uint256 value) external {
        importantVariable = value;
    }

    function addedFunction() external pure returns (uint256) {
        return 42;
    }
}
