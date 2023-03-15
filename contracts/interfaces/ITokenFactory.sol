// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface ITokenFactory {
    event TokenDeployed(string name, string symbol, address indexed tokenProxy);

    function getTokenBaseUri() external view returns (string memory);

    function setTokenBaseUri(string memory tokenBaseUri_) external;

    function deployToken(
        string calldata name,
        string calldata symbol,
        uint256 pricePerOneToken
    ) external;
}
