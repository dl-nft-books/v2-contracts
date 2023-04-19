// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "../../tokens/ERC721MintableToken.sol";

contract ERC721MintableTokenMock is ERC721MintableToken {
    function burn(uint256 tokenId_) external {
        _burn(tokenId_);
    }
}
