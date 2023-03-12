// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@dlsl/dev-modules/contracts-registry/AbstractDependant.sol";

contract Marketplace is AbstractDependant {
    function setDependencies(
        address contractsRegistry_,
        bytes calldata
    ) external override dependant {}
}
