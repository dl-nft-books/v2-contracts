// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * This is the TokenRegistry contract, a tuned ContractsRegistry contract. Its purpose is the management of
 * TokenPools.
 * The owner of this contract is capable of upgrading pools' implementation via the ProxyBeacon pattern
 */
interface ITokenRegistry {
    /**
     * @notice The function to set the new implementation for pools.
     * @param names_ The array of names of the pools to upgrade.
     * @param newImplementations_ The array of addresses of the new implementations.
     */
    function setNewImplementations(
        string[] calldata names_,
        address[] calldata newImplementations_
    ) external;

    /**
     * @notice The function to inject dependencies to existing pools.
     * @param name_ The name of the pool to inject dependencies to.
     * @param offset_ The offset from which to start injecting dependencies.
     * @param limit_ The limit of pools to inject dependencies to.
     */
    function injectDependenciesToExistingPools(
        string calldata name_,
        uint256 offset_,
        uint256 limit_
    ) external;

    /**
     * @notice The function to inject dependencies to existing pools with data.
     * @param name_ The name of the pool to inject dependencies to.
     * @param data_ The data to inject.
     * @param offset_ The offset from which to start injecting dependencies.
     * @param limit_ The limit of pools to inject dependencies to.
     */
    function injectDependenciesToExistingPoolsWithData(
        string calldata name_,
        bytes calldata data_,
        uint256 offset_,
        uint256 limit_
    ) external;

    /**
     * @notice The function to add a new pool.
     * @param poolName_ The name of the pool.
     * @param tokenAddress_ The address of the token.
     */
    function addProxyPool(string calldata poolName_, address tokenAddress_) external;

    /**
     * @notice The function to retrieve the name of the token pool.
     * @return The name of the token pool.
     */
    function TOKEN_POOL() external view returns (string memory);

    /**
     * @notice The function to retrieve the name of the voucher pool.
     * @return The name of the voucher pool.
     */
    function VOUCHER_POOL() external view returns (string memory);

    /**
     * @notice The function to check if the address is a token pool.
     * @param potentialPool_ The address to check.
     * @return True if the address is a token pool, false otherwise.
     */
    function isTokenPool(address potentialPool_) external view returns (bool);

    /**
     * @notice The function to check if the address is a voucher pool.
     * @param potentialPool_ The address to check.
     * @return True if the address is a voucher pool, false otherwise.
     */
    function isVoucherPool(address potentialPool_) external view returns (bool);
}
