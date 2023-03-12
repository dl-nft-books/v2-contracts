// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract Voucher_ERC20 is ERC20Permit {
    uint8 internal _decimals;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimalPlaces_
    ) ERC20(name_, symbol_) ERC20Permit(name_) {
        _decimals = decimalPlaces_;
    }

    function setDecimals(uint8 newDecimals_) external {
        _decimals = newDecimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to_, uint256 amount_) public {
        _mint(to_, amount_);
    }

    function mintBatch(address[] memory toArr_, uint256 amount_) public {
        for (uint256 i = 0; i < toArr_.length; i++) {
            mint(toArr_[i], amount_);
        }
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
