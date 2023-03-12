// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@dlsl/dev-modules/contracts-registry/AbstractDependant.sol";

import "../ContractsRegistry.sol";

contract ERC721MintableToken is AbstractDependant, ERC721EnumerableUpgradeable {
    using Strings for uint256;

    mapping(uint256 => string) private _tokenURIs;

    address public contractsRegistryAddress_;
    address public _roleManager;
    address public _tokenFactory;
    address public _marketplace;

    modifier onlyMarketplace() {
        _onlyMarketplace();
        _;
    }

    function __ERC721MintableToken_init(
        string memory name_,
        string memory symbol_
    ) external initializer {
        __ERC721_init(name_, symbol_);
    }

    function setDependencies(
        address contractsRegistry,
        bytes calldata
    ) external override dependant {
        _roleManager = ContractsRegistry(contractsRegistry).getRoleManagerContract();
        _tokenFactory = ContractsRegistry(contractsRegistry).getTokenFactoryContract();
        _marketplace = ContractsRegistry(contractsRegistry).getMarketplaceContract();
    }

    function mint(address to, uint256 tokenId, string memory uri) public onlyMarketplace {
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function _setTokenURI(uint256 tokenId, string memory _tokenURI) internal virtual {
        require(_exists(tokenId), "ERC721MintableToken: URI set of nonexistent token");
        _tokenURIs[tokenId] = _tokenURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "ERC721MintableToken: URI query for nonexistent token");

        string memory _tokenURI = _tokenURIs[tokenId];
        string memory base = _baseURI();

        // If there is no base URI, return the token URI.
        if (bytes(base).length == 0) {
            return _tokenURI;
        }
        // If both are set, concatenate the baseURI and tokenURI (via abi.encodePacked).
        if (bytes(_tokenURI).length > 0) {
            return string(abi.encodePacked(base, _tokenURI));
        }

        return super.tokenURI(tokenId);
    }

    function _burn(uint256 tokenId) internal override {
        super._burn(tokenId);

        if (bytes(_tokenURIs[tokenId]).length != 0) {
            delete _tokenURIs[tokenId];
        }
    }

    function _onlyMarketplace() internal view {
        require(_tokenFactory == msg.sender, "ERC721MintableToken: Caller is not a Marketplace");
    }
}
