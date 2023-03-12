// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@dlsl/dev-modules/contracts-registry/pools/pool-factory/AbstractPoolFactory.sol";

import "./interfaces/ITokenFactory.sol";
import "./interfaces/IContractsRegistry.sol";
import "./interfaces/ITokenRegistry.sol";
import "./interfaces/IRoleManager.sol";

contract TokenFactory is ITokenFactory, AbstractPoolFactory {
    string private tokenBaseUri;

    ITokenRegistry internal _tokenRegistry;
    IRoleManager internal _roleManager;

    event TokenDeployed(string name, string symbol, address indexed tokenProxy);

    modifier onlyAdministrator() {
        _onlyAdministrator();
        _;
    }

    function setDependencies(address contractsRegistry, bytes calldata data) public override {
        super.setDependencies(contractsRegistry, data);

        IContractsRegistry registry = IContractsRegistry(contractsRegistry);
        _tokenRegistry = ITokenRegistry(registry.getTokenRegistryContract());
        _roleManager = IRoleManager(registry.getRoleManagerContract());
    }

    function getTokenBaseUri() public view override returns (string memory) {
        return tokenBaseUri;
    }

    function setTokenBaseUri(string memory tokenBaseUri_) public override onlyAdministrator {
        tokenBaseUri = tokenBaseUri_;
    }

    function deployToken(string calldata name, string calldata symbol) external override {
        address tokenProxy = _deploy();

        emit TokenDeployed(name, symbol, tokenProxy);

        _register(tokenProxy);
        _injectDependencies(tokenProxy);
    }

    function _deploy() internal returns (address) {
        return _deploy(address(_tokenRegistry), _tokenRegistry.TOKEN_POOL());
    }

    function _register(address poolProxy) internal {
        _register(address(_tokenRegistry), _tokenRegistry.TOKEN_POOL(), poolProxy);
    }

    function _injectDependencies(address proxy) internal {
        _injectDependencies(address(_tokenRegistry), proxy);
    }

    function _onlyAdministrator() internal view {
        require(
            IRoleManager(_roleManager).isAdmin(msg.sender),
            "TokenFactory: Caller is not an administrator"
        );
    }
}
