// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/**
 * This is the TokenFactory contract, that is responsible for deploying new tokens.
 */
interface ITokenFactory {
    /**
     * @notice The function to deploy a new token.
     * @param name_ The name of the token.
     * @param symbol_ The symbol of the token.
     * @return The address of the deployed token.
    */
    function deployToken(string calldata name_, string calldata symbol_) external returns (address);

    /**
     * @notice The function to set the base URI for the tokens.
     * @param tokenBaseUri_ The base URI for the tokens.
    */
    function setTokenBaseUri(string memory tokenBaseUri_) external;
    
    /**
     * @notice The function to retrieve the base URI for the tokens.
     * @return The base URI for the tokens.
    */
    function getTokenBaseUri() external view returns (string memory);
}
