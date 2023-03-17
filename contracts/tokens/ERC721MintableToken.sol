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

    mapping(string => bool) private _existingTokenURIs;
    mapping(uint256 => string) private _tokenURIs;

    uint256 internal _tokenId;
    string internal _tokenName;
    string internal _tokenSymbol;

    address private _roleManager;
    address private _marketplace;

    modifier onlyMarketplace() {
        _onlyMarketplace();
        _;
    }

    modifier onlyTokenManager() {
        _onlyTokenManager();
        _;
    }

    function __ERC721MintableToken_init() external override initializer {
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

        _roleManager = registry_.getRoleManagerContract();
        _marketplace = registry_.getMarketplaceContract();
    }

    function mint(address to, uint256 tokenId, string memory uri) public onlyMarketplace {
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function burn(uint256 tokenId) public onlyTokenManager {
        _burn(tokenId);
    }

    function _setTokenURI(uint256 tokenId, string memory _tokenURI) internal virtual {
        //TODO: delete?
        require(_exists(tokenId), "ERC721MintableToken: URI set of nonexistent token");
        _tokenURIs[tokenId] = _tokenURI;
        _existingTokenURIs[_tokenURI] = true;
    }

    function _burn(uint256 tokenId) internal override {
        super._burn(tokenId);

        // TODO: check if it is needed
        if (bytes(_tokenURIs[tokenId]).length != 0) {
            delete _tokenURIs[tokenId];
            // delete _existingTokenURIs[_tokenURI];
        }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "ERC721MintableToken: URI query for nonexistent token");

        return _tokenURIs[tokenId];
    }

    function _onlyMarketplace() internal view {
        require(_marketplace == msg.sender, "ERC721MintableToken: Caller is not a Marketplace");
    }

    function _onlyTokenManager() internal view {
        require(
            IRoleManager(_roleManager).isTokenManager(msg.sender),
            "ERC721MintableToken: Caller is not a token manager"
        );
    }
}
