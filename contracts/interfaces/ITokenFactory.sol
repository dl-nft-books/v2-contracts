// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface ITokenFactory {
    function getTokenBaseUri() external view returns (string memory);

    function setTokenBaseUri(string memory tokenBaseUri_) external;

    function deployToken(string calldata name, string calldata symbol) external;
}
