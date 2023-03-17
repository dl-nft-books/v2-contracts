// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IMarketplace {
    struct TokenParams{
        address tokenContract;
        uint256 pricePerOneToken;
        uint256 minNFTFloorPrice;
        address voucherTokenContract;
        uint256 voucherTokensAmount;
        uint256 tokenId;
        string tokenName;
        string tokenSymbol;
        string baseTokenURI;

        mapping(string => bool) existingTokenURIs;
        mapping(uint256 => string) tokenURIs;
    }

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
     * @param tokenContract the address of the Token contract
     * @param pricePerOneToken the price per token in USD
     * @param voucherTokenContract the address of the voucher token contract
     * @param voucherTokensAmount the amount of voucher tokens
     * @param minNFTFloorPrice the minimal NFT floor price in USD for the NFT by NFT option
     */
    struct TokenContractInitParams {
        string tokenName;
        string tokenSymbol;
        address tokenContract;
        uint256 pricePerOneToken;
        address voucherTokenContract;
        uint256 voucherTokensAmount;
        uint256 minNFTFloorPrice;
    }
    /**
     * @notice This event is emitted when the TokenContract parameters are updated
     * @param tokenContract the address of the token contract
     * @param newPrice the new price per token for this collection
     * @param newMinNFTFloorPrice the new minimal NFT floor price
     * @param tokenName the new token name
     * @param tokenSymbol the new token symbol
     */
    event TokenContractParamsUpdated(
        address indexed tokenContract,
        uint256 newPrice,
        uint256 newMinNFTFloorPrice,
        string tokenName,
        string tokenSymbol
    );

    /**
     * @notice This event is emitted when the voucher parameters are updated
     * @param tokenContract the address of the token contract
     * @param newVoucherTokenContract the new voucher token contract address
     * @param newVoucherTokensAmount the new amount of voucher tokens
     */
    event VoucherParamsUpdated(address indexed tokenContract, address newVoucherTokenContract, uint256 newVoucherTokensAmount);

    /**
     * @notice This event is emitted when the owner of the contract withdraws the tokens that users have paid for tokens
     * @param tokenContract the address of the token contract
     * @param tokenAddr the address of the token to be withdrawn
     * @param recipient the address of the recipient
     * @param amount the number of tokens withdrawn
     */
    event PaidTokensWithdrawn(address indexed tokenContract, address indexed tokenAddr, address recipient, uint256 amount);

    /**
     * @notice This event is emitted when the user has successfully minted a new token
     * @param tokenContract the address of the token contract
     * @param recipient the address of the user who received the token and who paid for it
     * @param mintedTokenInfo the MintedTokenInfo struct with information about minted token
     * @param paymentTokenAddress the address of the payment token contract
     * @param paidTokensAmount the amount of tokens paid
     * @param paymentTokenPrice the price in USD of the payment token
     * @param discount discount value applied
     */
    event SuccessfullyMinted(
        address indexed tokenContract,
        address indexed recipient,
        MintedTokenInfo mintedTokenInfo,
        address indexed paymentTokenAddress,
        uint256 paidTokensAmount,
        uint256 paymentTokenPrice,
        uint256 discount
    );

    /**
     * @notice This event is emitted when the user has successfully minted a new token via NFT by NFT option
     * @param tokenContract the address of the token contract
     * @param recipient the address of the user who received the token and who paid for it
     * @param mintedTokenInfo the MintedTokenInfo struct with information about minted token
     * @param nftAddress the address of the NFT contract paid for the token mint
     * @param tokenId the ID of the token that was paid for the mint
     * @param nftFloorPrice the floor price of the NFT contract
     */
    event SuccessfullyMintedByNFT(
        address indexed tokenContract,
        address indexed recipient,
        MintedTokenInfo mintedTokenInfo,
        address indexed nftAddress,
        uint256 tokenId,
        uint256 nftFloorPrice
    );

    function __Marketplace_init() external;

    /**
     * @notice The function for updating token contract parameters
     * @param tokenContract_ the address of the token contract
     * @param newPrice_ the new price per one token
     * @param newMinNFTFloorPrice_ the new minimal NFT floor price
     * @param newTokenName_ the new token name
     * @param newTokenSymbol_ the new token symbol
     */
    function updateTokenContractParams(
        address tokenContract_,
        uint256 newPrice_,
        uint256 newMinNFTFloorPrice_,
        string memory newTokenName_,
        string memory newTokenSymbol_
    ) external;
    
    /**
     * @notice The function for updating voucher parameters
     * @param tokenContract_ the address of the token contract
     * @param newVoucherTokenContract_ the address of the new voucher token contract
     * @param newVoucherTokensAmount_ the new voucher tokens amount
     */
    function updateVoucherParams(address tokenContract_,address newVoucherTokenContract_, uint256 newVoucherTokensAmount_)
        external;

    /**
     * @notice The function for updating all TokenContract parameters
     * @param tokenContract_ the address of the token contract
     * @param newPrice_ the new price per one token
     * @param newMinNFTFloorPrice_ the new minimal NFT floor price
     * @param newVoucherTokenContract_ the address of the new voucher token contract
     * @param newVoucherTokensAmount_ the new voucher tokens amount
     * @param newTokenName_ the new token name
     * @param newTokenSymbol_ the new token symbol
     */
    function updateAllParams(
        address tokenContract_,
        uint256 newPrice_,
        uint256 newMinNFTFloorPrice_,
        address newVoucherTokenContract_,
        uint256 newVoucherTokensAmount_,
        string memory newTokenName_,
        string memory newTokenSymbol_
    ) external;

    // /**
    //  * @notice Function to withdraw the tokens that users paid to buy tokens
    //  * @param recipient_ the address of the recipient
    //  */
    // function withdrawPaidTokens(address recipient_) external;

    /**
     * @notice The function for creatinng a new coin for the token contract
     * @param tokenContract_ the address of the token contract
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
        address tokenContract_,
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
     * @notice The function for creatinng a new coin for the token contract by paying with NFT
     * @param tokenContract_ the address of the token contract
     * @param nftAddress_ the payment NFT token address
     * @param nftFloorPrice_ the floor price of the NFT collection in USD
     * @param tokenId_ the ID of the token with which you will pay for the mint
     * @param endTimestamp_ the end time of signature
     * @param tokenURI_ the tokenURI string
     * @param r_ the r parameter of the ECDSA signature
     * @param s_ the s parameter of the ECDSA signature
     * @param v_ the v parameter of the ECDSA signature
     */
    function mintTokenByNFT(
        address tokenContract_,
        address nftAddress_,
        uint256 nftFloorPrice_,
        uint256 tokenId_,
        uint256 endTimestamp_,
        string memory tokenURI_,
        bytes32 r_,
        bytes32 s_,
        uint8 v_
    ) external;

    /**
    //  * @notice The function to get an array of tokenIDs owned by a particular user
    //  * @param tokenContract_ the address of the token contract
    //  * @param userAddr_ the address of the user for whom you want to get information
    //  * @return tokenIDs_ the array of token IDs owned by the user
    //  */
    // function getUserTokenIDs(address tokenContract_, address userAddr_) external view returns (uint256[] memory tokenIDs_);
}
