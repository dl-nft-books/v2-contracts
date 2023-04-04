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
     * @return tokenProxy_ the address of the deployed token.
     */
    function deployToken(
        string calldata name_,
        string calldata symbol_
    ) external returns (address tokenProxy_);
}
