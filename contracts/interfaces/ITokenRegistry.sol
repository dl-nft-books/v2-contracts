// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

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
     * @param offset_ The offset from which to start injecting dependencies.
     * @param limit_ The limit of pools to inject dependencies to.
    */
    function injectDependenciesToExistingPools(uint256 offset_, uint256 limit_) external;

    /**
     * @notice The function to inject dependencies to existing pools with data.
     * @param data_ The data to inject.
     * @param offset_ The offset from which to start injecting dependencies.
     * @param limit_ The limit of pools to inject dependencies to.
    */
    function injectDependenciesToExistingPoolsWithData(
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
     * @notice The function to check if the address is a token pool.
     * @param potentialPool_ The address to check.
     * @return True if the address is a token pool, false otherwise.
    */
    function isTokenPool(address potentialPool_) external view returns (bool);
}
