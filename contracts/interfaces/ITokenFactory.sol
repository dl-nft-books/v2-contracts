// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface ITokenFactory {
    function setTokenBaseUri(string memory tokenBaseUri_) external;

    function deployToken(string calldata name, string calldata symbol) external returns (address);

    function getTokenBaseUri() external view returns (string memory);
}
