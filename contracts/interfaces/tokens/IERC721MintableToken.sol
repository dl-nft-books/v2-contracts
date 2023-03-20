// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IERC721MintableToken {
    // /**
    //  * @notice The function for initializing contract variables
    //  * @param initParams_ the ERC721MintableTokenInitParams structure with init params
    //  */
    function __ERC721MintableToken_init(string calldata name_, string calldata symbol_) external;

    function mint(address to, uint256 tokenId, string memory uri) external;

    function burn(uint256 tokenId) external;

    function updateTokenParams(string memory name_, string memory symbol_) external;
}
