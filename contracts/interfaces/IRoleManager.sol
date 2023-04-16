// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * This is the RoleManager contract, that is responsible for managing the roles of the system.
 */
interface IRoleManager {
    struct StoredRoleInfo {
        string roleName;
        EnumerableSet.AddressSet roleMembers;
    }

    struct DetailedRoleInfo {
        string roleName;
        bytes32 role;
        bytes32 roleAdmin;
        address[] members;
    }

    struct RoleParams {
        bytes32 role;
        bytes32 roleAdmin;
        string roleName;
    }

    /**
     * @notice The init function for the RoleManager contract.
     */
    function __RoleManager_init(RoleParams[] memory roleInitParams_) external;

    /**
     * @notice The function to grant multiple roles to multiple accounts.
     * @param roles_ The array of roles to grant.
     * @param accounts_ The array of accounts to grant the roles to.
     */
    function grantRolesBatch(bytes32[] calldata roles_, address[][] calldata accounts_) external;

    /**
     * @notice The function to retrieve the ADMINISTRATOR_ROLE role.
     * @return The ADMINISTRATOR_ROLE role.
     */
    function ADMINISTRATOR_ROLE() external view returns (bytes32);

    /**
     * @notice The function to retrieve the TOKEN_FACTORY_MANAGER role.
     * @return The TOKEN_FACTORY_MANAGER role.
     */
    function TOKEN_FACTORY_MANAGER() external view returns (bytes32);

    /**
     * @notice The function to retrieve the TOKEN_REGISTRY_MANAGER role.
     * @return The TOKEN_REGISTRY_MANAGER role.
     */
    function TOKEN_REGISTRY_MANAGER() external view returns (bytes32);

    /**
     * @notice The function to retrieve the TOKEN_MANAGER role.
     * @return The TOKEN_MANAGER role.
     */
    function TOKEN_MANAGER() external view returns (bytes32);

    /**
     * @notice The function to retrieve the ROLE_SUPERVISOR role.
     * @return The ROLE_SUPERVISOR role.
     */
    function ROLE_SUPERVISOR() external view returns (bytes32);

    /**
     * @notice The function to retrieve the WITHDRAWAL_MANAGER role.
     * @return The WITHDRAWAL_MANAGER role.
     */
    function WITHDRAWAL_MANAGER() external view returns (bytes32);

    /**
     * @notice The function to retrieve the MARKETPLACE_MANAGER role.
     * @return The MARKETPLACE_MANAGER role.
     */
    function MARKETPLACE_MANAGER() external view returns (bytes32);

    /**
     * @notice The function to retrieve the SIGNATURE_MANAGER role.
     * @return The SIGNATURE_MANAGER role.
     */
    function SIGNATURE_MANAGER() external view returns (bytes32);

    /**
     * @notice The function to check if an account has rights of an Administrator.
     * @param admin_ The account to check.
     * @return true if the account has rights of an Administrator, false otherwise.
     */
    function isAdmin(address admin_) external view returns (bool);

    /**
     * @notice The function to check if an account has rights of a TokenFactoryManager.
     * @param manager_ The account to check.
     * @return true if the account has rights of a TokenFactoryManager, false otherwise.
     */
    function isTokenFactoryManager(address manager_) external view returns (bool);

    /**
     * @notice The function to check if an account has rights of a TokenRegistryManager.
     * @param manager_ The account to check.
     * @return true if the account has rights of a TokenRegistryManager, false otherwise.
     */
    function isTokenRegistryManager(address manager_) external view returns (bool);

    /**
     * @notice The function to check if an account has rights of a TokenManager.
     * @param manager_ The account to check.
     * @return true if the account has rights of a TokenManager, false otherwise.
     */
    function isTokenManager(address manager_) external view returns (bool);

    /**
     * @notice The function to check if an account has rights of a RoleSupervisor.
     * @param supervisor_ The account to check.
     * @return true if the account has rights of a RoleSupervisor, false otherwise.
     */
    function isRoleSupervisor(address supervisor_) external view returns (bool);

    /**
     * @notice The function to check if an account has rights of a WithdrawalManager.
     * @param manager_ The account to check.
     * @return true if the account has rights of a WithdrawalManager, false otherwise.
     */
    function isWithdrawalManager(address manager_) external view returns (bool);

    /**
     * @notice The function to check if an account has rights of a MarketplaceManager.
     * @param manager_ The account to check.
     * @return true if the account has rights of a MarketplaceManager, false otherwise.
     */
    function isMarketplaceManager(address manager_) external view returns (bool);

    /**
     * @notice The function to check if an account has rights of a SignatureManager.
     * @param manager_ The account to check.
     * @return true if the account has rights of a SignatureManager, false otherwise.
     */
    function isSignatureManager(address manager_) external view returns (bool);

    /**
     * @notice The function to check if an account has specific roles or major.
     * @param roles_ The roles to check.
     * @param account_ The account to check.
     * @return true if the account has the specific roles, false otherwise.
     */
    function hasSpecificRoles(
        bytes32[] memory roles_,
        address account_
    ) external view returns (bool);

    /**
     * @notice The function to check if an account has any role.
     * @param account_ The account to check.
     * @return true if the account has any role, false otherwise.
     */
    function hasAnyRole(address account_) external view returns (bool);
}
