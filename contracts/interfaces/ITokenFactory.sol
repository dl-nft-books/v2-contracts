// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * This is the TokenFactory contract, that is responsible for deploying new tokens.
 */
interface ITokenFactory {
    /**
     * @notice This event is emitted when a new token is deployed
     * @param tokenProxyAddr the address of the newly deployed token proxy contract
     */
    event TokenDeployed(address indexed tokenProxyAddr);

    /**
     * @notice The function to deploy a new token
     * @param name_ the name of the token
     * @param symbol_ the symbol of the token
     * @return tokenProxy_ the address of the deployed token
     */
    function deployToken(
        string calldata name_,
        string calldata symbol_
    ) external returns (address tokenProxy_);

    /**
     * @notice The function to deploy a new voucher
     * @param name_ the name of the voucher
     * @param symbol_ the symbol of the voucher
     * @return voucherProxy_ the address of the deployed voucher
     */
    function deployVoucher(
        string calldata name_,
        string calldata symbol_
    ) external returns (address voucherProxy_);
}
