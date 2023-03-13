// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IRoleManager {
    function __RoleManager_init() external;

    function addAdmin(address _admin) external;

    function removeAdmin(address _admin) external;

    function isAdmin(address _admin) external view returns (bool);

    function ADMINISTATOR_ROLE() external view returns (bytes32);
}
