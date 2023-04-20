// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * This is the Voucher contract. Which is an ERC20 Permit token with minting and burning functionality
 */
interface IVoucher {
    /**
     * @notice The function for initializing contract with init params
     * @param name_ The name of the token
     * @param symbol_ The symbol of the token
     */
    function __Voucher_init(string calldata name_, string calldata symbol_) external;

    /**
     * @notice The function to mint a new token
     * @param to_ The address of the token owner
     * @param amount_ The amount of the token
     */
    function mint(address to_, uint256 amount_) external;

    /**
     * @notice The function to burn a token
     * @param from_ The address of the token owner
     * @param amount_ The amount of the token
     */
    function burn(address from_, uint256 amount_) external;
}
