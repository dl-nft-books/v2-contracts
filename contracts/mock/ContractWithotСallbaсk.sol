// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.18;

contract ContractWithoutCallback {
    fallback() external payable {
        revert("fallback not allowed");
    }
}
