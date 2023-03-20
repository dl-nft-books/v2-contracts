// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@dlsl/dev-modules/contracts-registry/AbstractDependant.sol";
import "@dlsl/dev-modules/utils/Globals.sol";

import "@dlsl/dev-modules/libs/decimals/DecimalsConverter.sol";

import "../interfaces/tokens/IERC721MintableToken.sol";
import "../interfaces/IRoleManager.sol";
import "../ContractsRegistry.sol";

// PausableUpgradeable,
// ReentrancyGuardUpgradeable
contract ERC721MintableToken is
    IERC721MintableToken,
    AbstractDependant,
    ERC721EnumerableUpgradeable,
    ERC721HolderUpgradeable
{
    using DecimalsConverter for uint256;
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;

    uint256 internal _nextTokenId;
    string internal _tokenName;
    string internal _tokenSymbol;

    IRoleManager private _roleManager;
    address private _marketplace;

    mapping(uint256 => string) private _tokenURIs;
    mapping(string => bool) private _existingTokenURIs;

    modifier onlyMarketplace() {
        _onlyMarketplace();
        _;
    }

    modifier onlyTokenManager() {
        _onlyTokenManager();
        _;
    }

    function __ERC721MintableToken_init(
        string calldata name_,
        string calldata symbol_
    ) external override initializer {
        __ERC721_init(name_, symbol_);

        _tokenName = name_;
        _tokenSymbol = symbol_;
        // __Pausable_init();
        // __ReentrancyGuard_init();
    }

    // function pause() external override onlyTokenManager {
    //     _pause();
    // }

    // function unpause() external override onlyTokenManager {
    //     _unpause();
    // }

    function setDependencies(
        address contractsRegistry_,
        bytes calldata
    ) external override dependant {
        IContractsRegistry registry_ = IContractsRegistry(contractsRegistry_);

        _roleManager = IRoleManager(registry_.getRoleManagerContract());
        _marketplace = registry_.getMarketplaceContract();
    }

    function mint(address to, uint256 tokenId, string memory uri) public onlyMarketplace {
        require(!_exists(tokenId), "ERC721MintableToken: Token with such id already exists.");

        require(tokenId == _nextTokenId++, "ERC721MintableToken: Token id is not valid.");

        require(
            !_existingTokenURIs[uri],
            "ERC721MintableToken: Token with such URI already exists."
        );

        _mint(to, tokenId);

        _setTokenURI(tokenId, uri);
    }

    function burn(uint256 tokenId) public onlyTokenManager {
        _burn(tokenId);
    }

    function updateTokenParams(
        string memory name_,
        string memory symbol_
    ) external onlyMarketplace {
        _tokenName = name_;
        _tokenSymbol = symbol_;
    }

    function _setTokenURI(uint256 tokenId, string memory _tokenURI) internal virtual {
        _tokenURIs[tokenId] = _tokenURI;
        _existingTokenURIs[_tokenURI] = true;
    }

    function _burn(uint256 tokenId) internal override {
        super._burn(tokenId);

        delete _existingTokenURIs[_tokenURIs[tokenId]];
        delete _tokenURIs[tokenId];
    }

    function name() public view override returns (string memory) {
        return _tokenName;
    }

    function symbol() public view override returns (string memory) {
        return _tokenSymbol;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "ERC721MintableToken: URI query for nonexistent token.");

        return _tokenURIs[tokenId];
    }

    function _onlyMarketplace() internal view {
        require(_marketplace == msg.sender, "ERC721MintableToken: Caller is not a marketplace.");
    }

    function _onlyTokenManager() internal view {
        require(
            _roleManager.isTokenManager(msg.sender),
            "ERC721MintableToken: Caller is not a token manager."
        );
    }
}
