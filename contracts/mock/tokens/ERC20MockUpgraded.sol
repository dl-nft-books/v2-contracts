// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./ERC20Mock.sol";

contract ERC20MockUpgraded is ERC20PermitUpgradeable {
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
