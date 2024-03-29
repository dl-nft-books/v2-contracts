// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * This is the ERC721MintableToken contract. Which is an ERC721 token with minting and burning functionality
 */
interface IERC721MintableToken {
    struct TokenMintData {
        uint256 tokenId;
        string tokenURI;
    }

    /**
     * @notice The function for initializing contract with init params
     * @param name_ The name of the token
     * @param symbol_ The symbol of the token
     */
    function __ERC721MintableToken_init(string calldata name_, string calldata symbol_) external;

    /**
     * @notice The function to mint a new token
     * @param to_ The address of the token owner
     */
    function mint(address to_, TokenMintData memory) external;

    /**
     * @notice The function to get the futute token id
     * @return The futute token id
     */
    function nextTokenId() external view returns (uint256);

    /**
     * @notice The function to get an array of tokenIDs owned by a particular user
     * @param user_ The address of the user
     * @return The array of tokenIDs owned by a particular user
     */
    function getUserTokenIDs(address user_) external view returns (uint256[] memory);
}
