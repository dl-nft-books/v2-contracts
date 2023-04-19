// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";

import "@dlsl/dev-modules/contracts-registry/AbstractDependant.sol";

import "../interfaces/IContractsRegistry.sol";
import "../interfaces/IMarketplace.sol";
import "../interfaces/tokens/IERC721MintableToken.sol";

contract ERC721MintableToken is
    IERC721MintableToken,
    AbstractDependant,
    ERC721EnumerableUpgradeable,
    ERC721HolderUpgradeable
{
    uint256 public nextTokenId;

    address internal _marketplace;

    mapping(uint256 => string) internal _tokenURIs;
    mapping(string => bool) internal _existingTokenURIs;

    modifier onlyMarketplace() {
        _onlyMarketplace();
        _;
    }

    function __ERC721MintableToken_init(
        string calldata name_,
        string calldata symbol_
    ) external override initializer {
        __ERC721_init(name_, symbol_);
    }

    function setDependencies(
        address contractsRegistry_,
        bytes calldata
    ) external override dependant {
        IContractsRegistry registry_ = IContractsRegistry(contractsRegistry_);

        _marketplace = registry_.getMarketplaceContract();
    }

    function mint(address to_, TokenMintData memory tokenData_) public onlyMarketplace {
        require(
            !_exists(tokenData_.tokenId),
            "ERC721MintableToken: Token with such id already exists."
        );

        require(
            tokenData_.tokenId == nextTokenId++,
            "ERC721MintableToken: Token id is not valid."
        );

        require(
            !_existingTokenURIs[tokenData_.tokenURI],
            "ERC721MintableToken: Token with such URI already exists."
        );

        _mint(to_, tokenData_.tokenId);

        _tokenURIs[tokenData_.tokenId] = tokenData_.tokenURI;
        _existingTokenURIs[tokenData_.tokenURI] = true;
    }

    function tokenURI(uint256 tokenId_) public view override returns (string memory) {
        require(_exists(tokenId_), "ERC721MintableToken: URI query for nonexistent token.");

        string memory tokenURI_ = _tokenURIs[tokenId_];
        string memory base_ = _baseURI();

        if (bytes(base_).length == 0) {
            return tokenURI_;
        }
        if (bytes(tokenURI_).length > 0) {
            return string(abi.encodePacked(base_, tokenURI_));
        }

        return base_;
    }

    function getUserTokenIDs(
        address user_
    ) external view override returns (uint256[] memory tokens_) {
        uint256 balance_ = balanceOf(user_);

        tokens_ = new uint256[](balance_);

        for (uint256 i = 0; i < balance_; i++) {
            tokens_[i] = tokenOfOwnerByIndex(user_, i);
        }
    }

    function _burn(uint256 tokenId_) internal override {
        super._burn(tokenId_);

        delete _existingTokenURIs[_tokenURIs[tokenId_]];
        delete _tokenURIs[tokenId_];
    }

    function _baseURI() internal view override returns (string memory) {
        return IMarketplace(_marketplace).baseTokenContractsURI();
    }

    function _onlyMarketplace() internal view {
        require(_marketplace == msg.sender, "ERC721MintableToken: Caller is not a marketplace.");
    }
}
