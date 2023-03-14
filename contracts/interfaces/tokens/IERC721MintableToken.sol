// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IERC721MintableToken{
    /**
     * @notice The structure that stores information about the minted token
     * @param tokenId the ID of the minted token
     * @param mintedTokenPrice the price to be paid by the user
     * @param tokenURI the token URI hash string
     */
    struct MintedTokenInfo {
        uint256 tokenId;
        uint256 mintedTokenPrice;
        string tokenURI;
    }

    /**
     * @notice The structure that stores TokenContract init params
     * @param tokenName the name of the collection (Uses in ERC721 and ERC712)
     * @param tokenSymbol the symbol of the collection (Uses in ERC721)
     * @param pricePerOneToken the price per token in USD
    //  * @param voucherTokenContract the address of the voucher token contract
    //  * @param voucherTokensAmount the amount of voucher tokens
    //  * @param minNFTFloorPrice the minimal NFT floor price in USD for the NFT by NFT option
     */
    struct ERC721MintableTokenInitParams {
        string tokenName;
        string tokenSymbol;
        uint256 pricePerOneToken;
        // address voucherTokenContract;
        // uint256 voucherTokensAmount;
        // uint256 minNFTFloorPrice;
    }

    /**
     * @notice This event is emitted when the TokenContract parameters are updated
     * @param newPrice the new price per token for this collection
     * @param tokenName the new token name
     * @param tokenSymbol the new token symbol
     */
    event TokenContractParamsUpdated(
        uint256 newPrice,
        // uint256 newMinNFTFloorPrice,
        string tokenName,
        string tokenSymbol
    );

    /**
     * @notice This event is emitted when the user has successfully minted a new token
     * @param recipient the address of the user who received the token and who paid for it
     * @param mintedTokenInfo the MintedTokenInfo struct with information about minted token
     * @param paymentTokenAddress the address of the payment token contract
     * @param paidTokensAmount the amount of tokens paid
     * @param paymentTokenPrice the price in USD of the payment token
     * @param discount discount value applied
     */
    event SuccessfullyMinted(
        address indexed recipient,
        MintedTokenInfo mintedTokenInfo,
        address indexed paymentTokenAddress,
        uint256 paidTokensAmount,
        uint256 paymentTokenPrice,
        uint256 discount
    );
    
    /**
     * @notice The function for initializing contract variables
     * @param initParams_ the ERC721MintableTokenInitParams structure with init params
     */
    function __ERC721MintableToken_init(
        ERC721MintableTokenInitParams calldata initParams_
    ) external;

    /**
     * @notice The function for updating token contract parameters
     * @param newPrice_ the new price per one token
     
     * @param newTokenName_ the new token name
     * @param newTokenSymbol_ the new token symbol
     */
     //  * @param newMinNFTFloorPrice_ the new minimal NFT floor price
    function updateERC721MintableTokenParams(
        uint256 newPrice_,
        // uint256 newMinNFTFloorPrice_,
        string memory newTokenName_,
        string memory newTokenSymbol_
    ) external;

    /**
     * @notice The function for pausing mint functionality
     */
    function pause() external;

    /**
     * @notice The function for unpausing mint functionality
     */
    function unpause() external;

    /**
     * @param paymentTokenAddress_ the payment token address
     * @param paymentTokenPrice_ the payment token price in USD
     * @param discount_ the discount value
     * @param endTimestamp_ the end time of signature
     * @param tokenURI_ the tokenURI string
     * @param r_ the r parameter of the ECDSA signature
     * @param s_ the s parameter of the ECDSA signature
     * @param v_ the v parameter of the ECDSA signature
     */
    function mintToken(
        address paymentTokenAddress_,
        uint256 paymentTokenPrice_,
        uint256 discount_,
        uint256 endTimestamp_,
        string memory tokenURI_,
        bytes32 r_,
        bytes32 s_,
        uint8 v_
    ) external payable;
    
    /**
     * @notice The function that returns the price per one token
     * @return price per one token in USD
     */
    function pricePerOneToken() external view returns (uint256);
}