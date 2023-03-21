// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IRoleManager {
    function __RoleManager_init() external;

    function grantRoleBatch(bytes32[] calldata roles_, address[] calldata accounts_) external;

    function ADMINISTRATOR_ROLE() external view returns (bytes32);

    function TOKEN_FACTORY_MANAGER() external view returns (bytes32);

    function TOKEN_REGISTRY_MANAGER() external view returns (bytes32);

    function TOKEN_MANAGER() external view returns (bytes32);

    function ROLE_SUPERVISOR() external view returns (bytes32);

    function WITHDRAWAL_MANAGER() external view returns (bytes32);

    function MARKETPLACE_MANAGER() external view returns (bytes32);

    function isAdmin(address _admin) external view returns (bool);

    function isTokenFactoryManager(address _manager) external view returns (bool);

    function isTokenRegistryManager(address _manager) external view returns (bool);

    function isTokenManager(address _manager) external view returns (bool);

    function isRoleSupervisor(address _supervisor) external view returns (bool);

    function isWithdrawalManager(address _manager) external view returns (bool);

    function isMarketplaceManager(address _manager) external view returns (bool);
}
