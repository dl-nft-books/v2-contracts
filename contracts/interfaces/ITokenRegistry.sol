// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/**
 * This is the TokenRegistry contract, a tuned ContractsRegistry contract. Its purpose is the management of
 * TokenPools.
 * The owner of this contract is capable of upgrading pools' implementation via the ProxyBeacon pattern
 */
interface ITokenRegistry {

    function setNewImplementations(
        string[] calldata names_,
        address[] calldata newImplementations_
    ) external;

    function injectDependenciesToExistingPools(uint256 offset_, uint256 limit_) external;

    function injectDependenciesToExistingPoolsWithData(
        bytes calldata data_,
        uint256 offset_,
        uint256 limit_
    ) external;

    function addProxyPool(string calldata poolName, address tokenAddress) external;

    function TOKEN_POOL() external view returns (string memory);
    
    function isTokenPool(address potentialPool) external view returns (bool);
}
