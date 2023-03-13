// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";

contract VoucherERC20 is ERC20PermitUpgradeable {
    uint8 internal _decimals;

    function __VoucherERC20_init(
        string memory name_,
        string memory symbol_,
        uint8 decimalPlaces_
    ) internal initializer {
        __ERC20_init(name_, symbol_);
        __ERC20Permit_init(name_);

        _decimals = decimalPlaces_;
    }

    function setDecimals(uint8 newDecimals_) external {
        _decimals = newDecimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function approveBatch(address[] memory fromArr_, address spender_, uint256 amount_) public {
        for (uint256 i = 0; i < fromArr_.length; i++) {
            _approve(fromArr_[i], spender_, amount_);
        }
    }

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual override {
        super.permit(owner, spender, value, deadline, v, r, s);
    }
}
