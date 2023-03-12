// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IRoleManager {
    function addAdmin(address _admin) external;

    function removeAdmin(address _admin) external;

    function isAdmin(address _admin) external view returns (bool);
}
