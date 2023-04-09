// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/**
 * This is the marketplace contract that stores information about
 * the token contracts and allows users to mint tokens.
 */

interface IMarketplace {
    /**
     * @notice The structure that stores information about the token contract
     * @param pricePerOneToken the price of one token in USD
     * @param minNFTFloorPrice the minimum floor price of the NFT contract
     * @param voucherTokensAmount the amount of tokens that can be bought with one voucher
     * @param voucherTokenContract the address of the voucher token contract
     * @param fundsRecipient the address of the recipient of the funds
     * @param isNFTBuyable the flag that indicates if the NFT can be bought for the token price
     * @param isDisabled the flag that indicates if the token contract is disabled
     */
    struct TokenParams {
        uint256 pricePerOneToken;
        uint256 minNFTFloorPrice;
        uint256 voucherTokensAmount;
        address voucherTokenContract;
        address fundsRecipient;
        bool isNFTBuyable;
        bool isDisabled;
    }

    /**
     * @notice The structure that stores base information about the token contract
     * @param tokenContract the address of the token contract
     * @param isDisabled the flag that indicates if the token contract is disabled
     * @param pricePerOneToken the price of one token in USD
     * @param tokenName the name of the token
     */
    struct BaseTokenParams {
        address tokenContract;
        bool isDisabled;
        uint256 pricePerOneToken;
        string tokenName;
    }

    /**
     * @notice The structure that stores detailed information about the token contract
     * @param tokenContract the address of the token contract
     * @param tokenParams the TokenParams struct with the token contract params
     * @param tokenName the name of the token
     * @param tokenSymbol the symbol of the token
     */
    struct DetailedTokenParams {
        address tokenContract;
        TokenParams tokenParams;
        string tokenName;
        string tokenSymbol;
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
     * @notice This event is emitted during the creation of a new token
     * @param tokenContract the address of the token contract
     * @param tokenName the name of the collection
     * @param tokenSymbol the symbol of the collection
     * @param tokenParams struct with the token contract params
     */
    event TokenContractDeployed(
        address indexed tokenContract,
        string tokenName,
        string tokenSymbol,
        TokenParams tokenParams
    );

    /**
     * @notice This event is emitted when the TokenContract parameters are updated
     * @param tokenContract the address of the token contract
     * @param tokenName the name of the collection
     * @param tokenSymbol the symbol of the collection
     * @param tokenParams the new TokenParams struct with new parameters
     */
    event TokenContractParamsUpdated(
        address indexed tokenContract,
        string tokenName,
        string tokenSymbol,
        TokenParams tokenParams
    );

    /**
     * @notice This event is emitted when the owner of the contract withdraws the currency
     * @param tokenAddr the address of the token to be withdrawn
     * @param recipient the address of the recipient
     * @param amount the number of tokens withdrawn
     */
    event PaidTokensWithdrawn(address indexed tokenAddr, address recipient, uint256 amount);

    /**
     * @notice This event is emitted when the user has successfully minted a new token
     * @param tokenContract the address of the token contract
     * @param recipient the address of the user who received the token and who paid for it
     * @param mintedTokenInfo the MintedTokenInfo struct with information about minted token
     * @param paymentTokenAddress the address of the payment token contract
     * @param paidTokensAmount the amount of tokens paid
     * @param paymentTokenPrice the price in USD of the payment token
     * @param discount discount value applied
     * @param fundsRecipient the address of the recipient of the funds
     */
    event SuccessfullyMinted(
        address indexed tokenContract,
        address indexed recipient,
        MintedTokenInfo mintedTokenInfo,
        address indexed paymentTokenAddress,
        uint256 paidTokensAmount,
        uint256 paymentTokenPrice,
        uint256 discount,
        address fundsRecipient
    );

    /**
     * @notice This event is emitted when the user has successfully minted a new token via NFT by NFT option
     * @param tokenContract the address of the token contract
     * @param recipient the address of the user who received the token and who paid for it
     * @param mintedTokenInfo the MintedTokenInfo struct with information about minted token
     * @param nftAddress the address of the NFT contract paid for the token mint
     * @param tokenId the ID of the token that was paid for the mint
     * @param nftFloorPrice the floor price of the NFT contract
     * @param fundsRecipient the address of the recipient of the funds
     */
    event SuccessfullyMintedByNFT(
        address indexed tokenContract,
        address indexed recipient,
        MintedTokenInfo mintedTokenInfo,
        address indexed nftAddress,
        uint256 tokenId,
        uint256 nftFloorPrice,
        address fundsRecipient
    );

    /**
     * @notice This event is emitted when the URI of the base token contracts has been updated
     * @param newBaseTokenContractsURI the new base token contracts URI string
     */
    event BaseTokenContractsURIUpdated(string newBaseTokenContractsURI);

    /**
     * @notice The init function for the Marketplace contract
     * @param baseTokenContractsURI_ the base token contracts URI string
     */
    function __Marketplace_init(string memory baseTokenContractsURI_) external;

    /**
     * @notice The function for pausing mint functionality
     */
    function pause() external;

    /**
     * @notice The function for unpausing mint functionality
     */
    function unpause() external;

    /**
     * @notice The function for creating a new token contract
     * @param name_ the name of the collection
     * @param symbol_ the symbol of the collection
     * @param tokenParams_ the TokenParams struct with the token contract params
     */
    function addToken(
        string memory name_,
        string memory symbol_,
        TokenParams memory tokenParams_
    ) external returns (address tokenProxy);

    /**
     * @notice The function for updating all TokenContract parameters
     * @param tokenContract_ the address of the token contract
     * @param name_ the name of the collection
     * @param symbol_ the symbol of the collection
     * @param newTokenParams_ the new TokenParams struct
     */
    function updateAllParams(
        address tokenContract_,
        string memory name_,
        string memory symbol_,
        TokenParams memory newTokenParams_
    ) external;

    /**
     * @notice Function to withdraw the currency that users paid to buy tokens
     * @param tokenAddr_ the address of the token to be withdrawn
     * @param recipient_ the address of the recipient
     */
    function withdrawCurrency(address tokenAddr_, address recipient_) external;

    /**
     * @notice The function for creatinng a new coin for the token contract
     * @param tokenContract_ the address of the token contract
     * @param futureTokenId_ the future token ID
     * @param paymentTokenAddress_ the payment token address
     * @param paymentTokenPrice_ the payment token price in USD
     * @param discount_ the discount value
     * @param endTimestamp_ the end time of signature
     * @param tokenURI_ the tokenURI string
     * @param r_ the r parameter of the ECDSA signature
     * @param s_ the s parameter of the ECDSA signature
     * @param v_ the v parameter of the ECDSA signature
     */
    function buyToken(
        address tokenContract_,
        uint256 futureTokenId_,
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
     * @param futureTokenId_ the future token ID
     * @param nftAddress_ the payment NFT token address
     * @param nftFloorPrice_ the floor price of the NFT collection in USD
     * @param tokenId_ the ID of the token with which you will pay for the mint
     * @param endTimestamp_ the end time of signature
     * @param tokenURI_ the tokenURI string
     * @param r_ the r parameter of the ECDSA signature
     * @param s_ the s parameter of the ECDSA signature
     * @param v_ the v parameter of the ECDSA signature
     */
    function buyTokenByNFT(
        address tokenContract_,
        uint256 futureTokenId_,
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
     * @notice The function for updating the base token contracts URI string
     * @param baseTokenContractsURI_ the new base token contracts URI string
     */
    function setBaseTokenContractsURI(string memory baseTokenContractsURI_) external;

    /**
     * @notice The function that returns the base token contracts URI string
     * @return base token contracts URI string
     */
    function baseTokenContractsURI() external view returns (string memory);

    /**
     * @notice The function to get an array of tokenIDs owned by a particular user
     * @param tokenContract_ the address of the token contract
     * @param userAddr_ the address of the user for whom you want to get information
     * @return tokenIDs_ the array of token IDs owned by the user
     */
    function getUserTokenIDs(
        address tokenContract_,
        address userAddr_
    ) external view returns (uint256[] memory tokenIDs_);

    /**
     * @notice The function that returns the total TokenContracts count
     * @return total TokenContracts count
     */
    function getTokenContractsCount() external view returns (uint256);

    /**
     * @notice The function that returns the active TokenContracts count
     * @return active TokenContracts count
     */
    function getActiveTokenContractsCount() external view returns (uint256);

    /**
     * @notice The function for getting addresses of token contracts with pagination
     * @param offset_ the offset for pagination
     * @param limit_ the maximum number of elements for
     * @return array with the addresses of the token contracts
     */
    function getTokenContractsPart(
        uint256 offset_,
        uint256 limit_
    ) external view returns (address[] memory);

    /**
     * @notice The function that returns the token params of the token contract
     * @param tokenContracts_ the array of addresses of the token contracts
     * @return the BaseTokenParams array struct with the base token params
     */
    function getBaseTokenParams(
        address[] memory tokenContracts_
    ) external view returns (BaseTokenParams[] memory);

    /**
     * @notice The function that returns the base token params of the token contract with pagination
     * @param offset_ the offset for pagination
     * @param limit_ the maximum number of elements for
     * @return tokenParams_ the array of BaseTokenParams structs with the base token params
     */
    function getBaseTokenParamsPart(
        uint256 offset_,
        uint256 limit_
    ) external view returns (BaseTokenParams[] memory tokenParams_);

    /**
     * @notice The function that returns the token params of the token contracts
     * @param tokenContracts_ the array of addresses of the token contracts
     * @return the DetailedTokenParams array struct with the detailed token params
     */
    function getDetailedTokenParams(
        address[] memory tokenContracts_
    ) external view returns (DetailedTokenParams[] memory);

    /**
     * @notice The function that returns the detailed token params of the token contract with pagination
     * @param offset_ the offset for pagination
     * @param limit_ the maximum number of elements for
     * @return tokenParams_ the array of DetailedTokenParams structs with the detailed token params
     */
    function getDetailedTokenParamsPart(
        uint256 offset_,
        uint256 limit_
    ) external view returns (DetailedTokenParams[] memory tokenParams_);
}
