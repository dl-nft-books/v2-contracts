// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ERC721Mock is ERC721 {
    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {}

    function mint(address userAddr_, uint256 tokenId_) external {
        _mint(userAddr_, tokenId_);
    }

    function mintBatch(address[] memory userAddresses_, uint256[] memory tokenIDs_) external {
        for (uint256 i = 0; i < userAddresses_.length; i++) {
            _mint(userAddresses_[i], tokenIDs_[i]);
        }
    }
}
