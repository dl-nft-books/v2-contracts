// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "@solarity/solidity-lib/contracts-registry/AbstractDependant.sol";
import "@solarity/solidity-lib/libs/arrays/Paginator.sol";

import "./interfaces/IContractsRegistry.sol";
import "./interfaces/IRoleManager.sol";

contract RoleManager is IRoleManager, AccessControlUpgradeable, AbstractDependant {
    using Paginator for EnumerableSet.Bytes32Set;
    using EnumerableSet for *;

    bytes32 public constant ADMINISTRATOR_ROLE = keccak256("ADMINISTRATOR_ROLE");
    bytes32 public constant TOKEN_FACTORY_MANAGER = keccak256("TOKEN_FACTORY_MANAGER");
    bytes32 public constant TOKEN_REGISTRY_MANAGER = keccak256("TOKEN_REGISTRY_MANAGER");
    bytes32 public constant TOKEN_MANAGER = keccak256("TOKEN_MANAGER");
    bytes32 public constant ROLE_SUPERVISOR = keccak256("ROLE_SUPERVISOR");
    bytes32 public constant WITHDRAWAL_MANAGER = keccak256("WITHDRAWAL_MANAGER");
    bytes32 public constant MARKETPLACE_MANAGER = keccak256("MARKETPLACE_MANAGER");
    bytes32 public constant SIGNATURE_MANAGER = keccak256("SIGNATURE_MANAGER");

    EnumerableSet.Bytes32Set internal _supportedRoles;

    mapping(bytes32 => StoredRoleInfo) internal _rolesInfo;
    mapping(address => EnumerableSet.Bytes32Set) internal _userRoles;

    function __RoleManager_init(
        BaseRoleData[] memory rolesInitData_
    ) external override initializer {
        __AccessControl_init();

        _updateRolesParams(rolesInitData_);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMINISTRATOR_ROLE, msg.sender);
    }

    function setDependencies(
        address contractsRegistry_,
        bytes memory data_
    ) public override dependant {}

    function updateRolesParams(
        BaseRoleData[] memory rolesData_
    ) external override onlyRole(ADMINISTRATOR_ROLE) {
        _updateRolesParams(rolesData_);
    }

    function removeRoles(
        bytes32[] memory rolesToRemove_
    ) external override onlyRole(ADMINISTRATOR_ROLE) {
        for (uint256 i = 0; i < rolesToRemove_.length; i++) {
            require(
                rolesToRemove_[i] != ADMINISTRATOR_ROLE,
                "RoleManager: Cannot remove administrator role."
            );

            require(isRoleExists(rolesToRemove_[i]), "RoleManager: Role does not exists.");

            delete _rolesInfo[rolesToRemove_[i]].roleName;

            _supportedRoles.remove(rolesToRemove_[i]);
        }
    }

    function grantRolesBatch(
        bytes32[] calldata roles_,
        address[][] calldata accounts_
    ) public override {
        _updateRolesMembersBatch(roles_, accounts_, _grantRole);
    }

    function revokeRolesBatch(
        bytes32[] calldata roles_,
        address[][] calldata accounts_
    ) external override {
        _updateRolesMembersBatch(roles_, accounts_, _revokeRole);
    }

    function grantRoles(bytes32 role_, address[] calldata accounts_) external override {
        _updateRolesMembers(role_, accounts_, _grantRole);
    }

    function revokeRoles(bytes32 role_, address[] calldata accounts_) external override {
        _updateRolesMembers(role_, accounts_, _revokeRole);
    }

    function isAdmin(address admin_) external view override returns (bool) {
        return hasRole(ADMINISTRATOR_ROLE, admin_);
    }

    function isTokenFactoryManager(address manager_) external view override returns (bool) {
        return hasRole(TOKEN_FACTORY_MANAGER, manager_);
    }

    function isTokenRegistryManager(address manager_) external view override returns (bool) {
        return hasRole(TOKEN_REGISTRY_MANAGER, manager_);
    }

    function isTokenManager(address manager_) external view override returns (bool) {
        return hasRole(TOKEN_MANAGER, manager_);
    }

    function isRoleSupervisor(address supervisor_) external view override returns (bool) {
        return hasRole(ROLE_SUPERVISOR, supervisor_);
    }

    function isWithdrawalManager(address manager_) external view override returns (bool) {
        return hasRole(WITHDRAWAL_MANAGER, manager_);
    }

    function isMarketplaceManager(address manager_) external view override returns (bool) {
        return hasRole(MARKETPLACE_MANAGER, manager_);
    }

    function isSignatureManager(address manager_) external view override returns (bool) {
        return hasRole(SIGNATURE_MANAGER, manager_);
    }

    function getUserRoles(address userAddr_) external view returns (bytes32[] memory) {
        return _userRoles[userAddr_].values();
    }

    function hasAnyRole(address account_) external view override returns (bool) {
        return _userRoles[account_].length() > 0;
    }

    function getSupportedRolesCount() external view override returns (uint256) {
        return _supportedRoles.length();
    }

    function getAllRolesDetailedInfo() external view override returns (DetailedRoleInfo[] memory) {
        return getRolesDetailedInfo(getAllSupportedRoles());
    }

    function getAllRolesBaseInfo() external view override returns (BaseRoleData[] memory) {
        return getRolesBaseInfo(getAllSupportedRoles());
    }

    function getRolesDetailedInfoPart(
        uint256 offset_,
        uint256 limit_
    ) external view override returns (DetailedRoleInfo[] memory) {
        return getRolesDetailedInfo(getSupportedRolesPart(offset_, limit_));
    }

    function getRolesBaseInfoPart(
        uint256 offset_,
        uint256 limit_
    ) external view override returns (BaseRoleData[] memory) {
        return getRolesBaseInfo(getSupportedRolesPart(offset_, limit_));
    }

    function getAllSupportedRoles() public view override returns (bytes32[] memory) {
        return _supportedRoles.values();
    }

    function getSupportedRolesPart(
        uint256 offset_,
        uint256 limit_
    ) public view override returns (bytes32[] memory) {
        return _supportedRoles.part(offset_, limit_);
    }

    function getRolesDetailedInfo(
        bytes32[] memory roles_
    ) public view override returns (DetailedRoleInfo[] memory rolesDetailedInfo_) {
        rolesDetailedInfo_ = new DetailedRoleInfo[](roles_.length);

        for (uint256 i = 0; i < roles_.length; i++) {
            rolesDetailedInfo_[i] = DetailedRoleInfo(
                _getRoleBaseInfo(roles_[i]),
                getRoleMembers(roles_[i])
            );
        }
    }

    function getRolesBaseInfo(
        bytes32[] memory roles_
    ) public view override returns (BaseRoleData[] memory rolesBaseInfo_) {
        rolesBaseInfo_ = new BaseRoleData[](roles_.length);

        for (uint256 i = 0; i < roles_.length; i++) {
            rolesBaseInfo_[i] = _getRoleBaseInfo(roles_[i]);
        }
    }

    function getRoleMembersCount(bytes32 role_) public view override returns (uint256) {
        return _rolesInfo[role_].roleMembers.length();
    }

    function getRoleMembers(bytes32 role_) public view override returns (address[] memory) {
        return _rolesInfo[role_].roleMembers.values();
    }

    function isRoleExists(bytes32 role_) public view override returns (bool) {
        return _supportedRoles.contains(role_);
    }

    function hasSpecificRoles(
        bytes32[] memory roles_,
        address account_
    ) public view override returns (bool) {
        for (uint256 i = 0; i < roles_.length; i++) {
            if (hasRole(roles_[i], account_)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @dev Return false for an unsupported role
     * @inheritdoc IAccessControlUpgradeable
     */
    function hasRole(bytes32 role_, address account_) public view override returns (bool) {
        if (!isRoleExists(role_)) {
            return false;
        }

        return super.hasRole(ADMINISTRATOR_ROLE, account_) || super.hasRole(role_, account_);
    }

    function _grantRole(bytes32 role_, address account) internal virtual override {
        super._grantRole(role_, account);

        _rolesInfo[role_].roleMembers.add(account);
        _userRoles[account].add(role_);
    }

    function _revokeRole(bytes32 role_, address account) internal virtual override {
        _onlyNotLastAdministrator(role_);

        super._revokeRole(role_, account);

        _rolesInfo[role_].roleMembers.remove(account);
        _userRoles[account].remove(role_);
    }

    function _updateRolesParams(BaseRoleData[] memory rolesData_) internal {
        for (uint256 i = 0; i < rolesData_.length; i++) {
            BaseRoleData memory currentData_ = rolesData_[i];

            require(
                bytes(currentData_.roleName).length > 0,
                "RoleManager: Role name cannot be an empty string."
            );

            _setRoleAdmin(currentData_.role, currentData_.roleAdmin);
            _rolesInfo[currentData_.role].roleName = currentData_.roleName;
            _supportedRoles.add(currentData_.role);
        }
    }

    function _updateRolesMembersBatch(
        bytes32[] calldata roles_,
        address[][] calldata accounts_,
        function(bytes32, address) internal _updateFunc
    ) internal {
        require(
            roles_.length == accounts_.length,
            "RoleManager: Roles and accounts arrays must be of equal length."
        );

        for (uint256 i = 0; i < roles_.length; i++) {
            _updateRolesMembers(roles_[i], accounts_[i], _updateFunc);
        }
    }

    function _updateRolesMembers(
        bytes32 role_,
        address[] calldata accounts_,
        function(bytes32, address) internal _updateFunc
    ) internal onlyRole(getRoleAdmin(role_)) {
        for (uint256 i = 0; i < accounts_.length; i++) {
            _updateFunc(role_, accounts_[i]);
        }
    }

    function _getRoleBaseInfo(bytes32 role_) internal view returns (BaseRoleData memory) {
        return BaseRoleData(role_, getRoleAdmin(role_), _rolesInfo[role_].roleName);
    }

    function _onlyNotLastAdministrator(bytes32 role_) internal view {
        require(
            role_ != ADMINISTRATOR_ROLE || getRoleMembersCount(ADMINISTRATOR_ROLE) > 1,
            "RoleManager: Cannot remove last administrator."
        );
    }
}
