// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IERC721MintableToken {
    // /**
    //  * @notice The function for initializing contract variables
    //  * @param initParams_ the ERC721MintableTokenInitParams structure with init params
    //  */
    function __ERC721MintableToken_init(// ERC721MintableTokenInitParams calldata initParams_)
        external;

    /**
     * @notice The function for pausing mint functionality
     */
    function pause() external;

    /**
     * @notice The function for unpausing mint functionality
     */
    function unpause() external;

    function mint(address to, uint256 tokenId, string memory uri) external;
}
