// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./tokens/IERC721MintableToken.sol";

/**
 * This is the marketplace contract that stores information about
 * the token contracts and allows users to mint tokens.
 */
interface IMarketplace {
    /**
     * @notice Enum representing different payment options available for purchasing
     * @param NATIVE the payment can be made in native cryptocurrency
     * @param ERC20 the payment can be made in any ERC20 token
     * @param NFT the payment can be made using an NFT
     * @param VOUCHER the payment can be made using a voucher
     * @param REQUEST the payment can be made using a request
     */
    enum PaymentType {
        NATIVE,
        ERC20,
        NFT,
        VOUCHER,
        REQUEST
    }

    /**
     * @notice Enum representing different NFT request statuses
     * @param NONE the request has not been created
     * @param PENDING the request is pending
     * @param ACCEPTED the request has been accepted
     * @param CANCELED the request has been canceled
     */
    enum NFTRequestStatus {
        NONE,
        PENDING,
        ACCEPTED,
        CANCELED
    }

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
     * @notice The structure that stores information about the NFT request
     * @param requester the address of the offerer
     * @param tokenContract the address of the token contract
     * @param nftContract the address of the NFT contract
     * @param nftId the ID of the NFT
     * @param status the status of the request
     */
    struct NFTRequestInfo {
        address requester;
        address tokenContract;
        address nftContract;
        uint256 nftId;
        NFTRequestStatus status;
    }

    /**
     * @notice Struct representing the buying parameters for purchasing an NFT
     * @param tokenContract the contract address of the token used for payment
     * @param paymentDetails the payment details for purchasing an NFT
     * @param tokenData the init data for new token
     */
    struct BuyParams {
        address tokenContract;
        PaymentDetails paymentDetails;
        IERC721MintableToken.TokenMintData tokenData;
    }

    /**
     * @notice Struct representing payment details for purchasing an NFT
     * @param paymentTokenAddress the address of the token used for payment
     * @param paymentTokenPrice the price of the token used for payment
     * @param discount the discount amount for the purchase
     * @param nftTokenId the ID of the NFT to be purchased (only for NFT payment option)
     */
    struct PaymentDetails {
        address paymentTokenAddress;
        uint256 paymentTokenPrice;
        uint256 discount;
        uint256 nftTokenId;
    }

    /**
     * @notice Struct representing the signature for a transaction
     * @param endSigTimestamp the signature expiration time
     * @param r the r value of the signature
     * @param s the s value of the signature
     * @param v the v value of the signature
     */
    struct SigData {
        uint256 endSigTimestamp;
        bytes32 r;
        bytes32 s;
        uint8 v;
    }

    /**
     * @notice The structure that stores information about the user tokens
     * @param tokenContract the address of the token contract
     * @param tokenIds the array of token IDs
     */
    struct UserTokens {
        address tokenContract;
        uint256[] tokenIds;
    }

    /**
     * @notice The structure that stores brief information about the token contract
     * @param baseTokenData the BaseTokenData struct with the base token contract data
     * @param pricePerOneToken the price of one token in USD
     * @param isDisabled the flag that indicates if the token contract is disabled
     */
    struct BriefTokenInfo {
        BaseTokenData baseTokenData;
        uint256 pricePerOneToken;
        bool isDisabled;
    }

    /**
     * @notice The structure that stores detailed information about the token contract
     * @param baseTokenData the BaseTokenData struct with the base token contract data
     * @param tokenParams the TokenParams struct with the token contract params
     */
    struct DetailedTokenInfo {
        BaseTokenData baseTokenData;
        TokenParams tokenParams;
    }

    /**
     * @notice The structure that stores base information about the token contract
     * @param tokenContract the address of the token contract
     * @param tokenName the name of the token
     * @param tokenSymbol the symbol of the token
     */
    struct BaseTokenData {
        address tokenContract;
        string tokenName;
        string tokenSymbol;
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
     * @notice This event is emitted when a token has been successfully purchased
     * @param recipient the address of the recipient of the purchased token
     * @param mintedTokenPrice the price of the minted token
     * @param paidTokensAmount the amount of tokens paid
     * @param buyParams the buying parameters used for purchasing the token
     * @param paymentType the type of payment used for purchasing the token
     */
    event TokenSuccessfullyPurchased(
        address indexed recipient,
        uint256 mintedTokenPrice,
        uint256 paidTokensAmount,
        BuyParams buyParams,
        PaymentType paymentType
    );

    /**
     * @notice This event is emitted when a token has been successfully exchanged
     * @param recipient the address of the recipient of the purchased token
     * @param requestId the ID of the request
     * @param tokenData the init data for minted token
     * @param nftRequestInfo the NFTRequestInfo struct with the NFT request info
     */
    event TokenSuccessfullyExchanged(
        address indexed recipient,
        uint256 requestId,
        IERC721MintableToken.TokenMintData tokenData,
        NFTRequestInfo nftRequestInfo
    );

    /**
     * @notice This event is emitted when the user creates a new NFT request
     * @param requestId the ID of the request
     * @param requester the address of the user who created the request
     * @param tokenContract the address of the desired token contract
     * @param nftContract the address of the NFT contract
     * @param nftId the ID of the NFT
     */
    event NFTRequestCreated(
        uint256 indexed requestId,
        address indexed requester,
        address indexed tokenContract,
        address nftContract,
        uint256 nftId
    );

    /**
     * @notice This event is emitted when the user approves the NFT request
     * @param requestId the ID of the request
     */
    event NFTRequestCanceled(uint256 indexed requestId);

    /**
     * @notice This event is emitted when the TokenContract parameters are updated
     * @param tokenContract the address of the token contract
     * @param tokenParams the new TokenParams struct with new parameters
     */
    event TokenParamsUpdated(address indexed tokenContract, TokenParams tokenParams);

    /**
     * @notice This event is emitted when the owner of the contract withdraws the currency
     * @param tokenAddr the address of the token to be withdrawn
     * @param recipient the address of the recipient
     * @param amount the number of tokens withdrawn
     */
    event PaidTokensWithdrawn(address indexed tokenAddr, address recipient, uint256 amount);

    /**
     * @notice This event is emitted when NFT tokens are withdrawn from the marketplace contract
     * @param nftAddr the address of the NFT contract
     * @param recipient the address of the recipient of the withdrawn tokens
     * @param tokenIDs the array of uint256 token IDs that were withdrawn
     */
    event NFTTokensWithdrawn(address indexed nftAddr, address recipient, uint256[] tokenIDs);

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
     * @notice The function for updating the base token contracts URI string
     * @param baseTokenContractsURI_ the new base token contracts URI string
     */
    function setBaseTokenContractsURI(string memory baseTokenContractsURI_) external;

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
     * @param newTokenParams_ the new TokenParams struct
     */
    function updateTokenParams(
        address tokenContract_,
        TokenParams memory newTokenParams_
    ) external;

    /**
     * @notice Function to withdraw the currency that users paid to buy tokens
     * @param tokenAddr_ the address of the token to be withdrawn
     * @param recipient_ the address of the recipient
     * @param desiredAmount_ the amount to withdraw
     * @param withdrawAll_ the flag to withdraw everything
     */
    function withdrawCurrency(
        address tokenAddr_,
        address recipient_,
        uint256 desiredAmount_,
        bool withdrawAll_
    ) external;

    /**
     * @notice This function allows withdrawal of NFT tokens to a specified recipient
     * @param nft_ the address of the ERC721 contract, which tokens will be withdrawn from the marketplace contract
     * @param recipient_ the address of the recipient who will receive the withdrawn NFT tokens
     * @param tokenIds_ the array of uint256 token IDs representing the NFT tokens to be withdrawn
     */
    function withdrawNFTs(IERC721 nft_, address recipient_, uint256[] memory tokenIds_) external;

    /**
     * @notice Function that allows users to buy a token using Ether
     * @dev Requires the caller to send Ether to the contract for the purchase
     * @param buyParams_ the buying parameters used for purchasing the token
     * @param sig_ the signature for the purchasing
     */
    function buyTokenWithETH(BuyParams memory buyParams_, SigData memory sig_) external payable;

    /**
     * @notice Function that allows users to buy a token using an ERC20 token
     * @dev Requires the caller to approve the ERC20 token transfer to this contract before calling this function
     * @param buyParams_ the buying parameters used for purchasing the token
     * @param sig_ the signature for the purchasing
     */
    function buyTokenWithERC20(BuyParams memory buyParams_, SigData memory sig_) external;

    /**
     * @notice Function that allows users to buy a token using a voucher
     *
     * @param buyParams_ the buying parameters used for purchasing the token
     * @param sig_ the signature for the purchasing
     */
    function buyTokenWithVoucher(BuyParams memory buyParams_, SigData memory sig_) external;

    /**
     * @notice Function that allows users to buy an NFT token using an NFT
     * @dev Requires the caller to own the NFT used for payment
     * @param buyParams_ the buying parameters used for purchasing the token
     * @param sig_ the signature for the purchasing
     */
    function buyTokenWithNFT(BuyParams memory buyParams_, SigData memory sig_) external;

    /**
     * @notice The function to accept an NFT request
     * @param requestId_ the ID of the pending NFT request
     * @param tokenData_ the data required to the new NFT token
     * @param sig_ the signature, which is needed to confirm the request
     */
    function acceptRequest(
        uint256 requestId_,
        IERC721MintableToken.TokenMintData memory tokenData_,
        SigData memory sig_
    ) external;

    /**
     * @notice Function that allows users to create a new NFT request
     * @param tokenContract_ the address of the desired token contract
     * @param nftContract_ the address of the NFT contract
     * @param nftId_ the ID of the NFT
     */
    function createNFTRequest(
        address tokenContract_,
        address nftContract_,
        uint256 nftId_
    ) external returns (uint256 requestId_);

    /**
     * @notice Function that allows users to cancel an NFT request
     * @param requestId_ the ID of the request
     */
    function cancelNFTRequest(uint256 requestId_) external;

    /**
     * @notice The function that returns the base token contracts URI string
     * @return base token contracts URI string
     */
    function baseTokenContractsURI() external view returns (string memory);

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
     * @notice The function that gets the total number of pending NFT mint requests
     * @return The number of pending NFT mint requests
     */
    function getAllPendingRequestsCount() external view returns (uint256);

    /**
     * @notice The function that gets the number of pending NFT mint requests for a specific user
     * @param userAddr_ the address of the user for whom to retrieve the number of pending requests
     * @return The number of pending NFT mint requests for the specified user
     */
    function getUserPendingRequestsCount(address userAddr_) external view returns (uint256);

    /**
     * @notice The function to get an array of token owned by a particular user with pagination
     * @param userAddr_ the address of the user for whom you want to get information
     * @param offset_ the offset for pagination
     * @param limit_ the maximum number of elements for
     * @return userTokens_ the array of UserTokens structs
     */
    function getUserTokensPart(
        address userAddr_,
        uint256 offset_,
        uint256 limit_
    ) external view returns (UserTokens[] memory userTokens_);

    /**
     * @notice The function that returns the brief token info of the token contract with pagination
     * @param offset_ the offset for pagination
     * @param limit_ the maximum number of elements for
     * @return tokenParams_ the array of BriefTokenInfo structs with the brief token info
     */
    function getBriefTokenInfoPart(
        uint256 offset_,
        uint256 limit_
    ) external view returns (BriefTokenInfo[] memory tokenParams_);

    /**
     * @notice The function that returns the detailed token info of the token contract with pagination
     * @param offset_ the offset for pagination
     * @param limit_ the maximum number of elements for
     * @return tokenParams_ the array of DetailedTokenInfo structs with the detailed token info
     */
    function getDetailedTokenInfoPart(
        uint256 offset_,
        uint256 limit_
    ) external view returns (DetailedTokenInfo[] memory tokenParams_);

    /**
     * @notice The function to retrieve brief information about token contracts
     * @param tokenContracts_ the array of token contracts
     * @return baseTokenParams_ the array of BriefTokenInfo structs representing the requested information for each token contract
     */
    function getBriefTokenInfo(
        address[] memory tokenContracts_
    ) external view returns (BriefTokenInfo[] memory baseTokenParams_);

    /**
     * @notice The function to retrieve detailed information about token contracts
     * @param tokenContracts_ the array of token contracts addresses
     * @return detailedTokenParams_ the array of DetailedTokenInfo structs representing the requested information for each token contract
     */
    function getDetailedTokenInfo(
        address[] memory tokenContracts_
    ) external view returns (DetailedTokenInfo[] memory detailedTokenParams_);

    /**
     * @notice The function to retrieve information about multiple NFT mint requests
     * @param requestsId_ the array of IDs representing the NFT mint requests for which to retrieve information
     * @return nftRequestsInfo_ the array of NFTRequestInfo structs representing the requested information for each NFT mint request
     */
    function getNFTRequestsInfo(
        uint256[] memory requestsId_
    ) external view returns (NFTRequestInfo[] memory nftRequestsInfo_);

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
     * @notice The function that gets a part of all pending requests
     * @param offset_ the offset to start getting pending requests from
     * @param limit_ the maximum number of pending requests to return
     * @return The array of pending request IDs
     */
    function getPendingRequestsPart(
        uint256 offset_,
        uint256 limit_
    ) external view returns (uint256[] memory);

    /**
     * @notice The function that gets a part of pending requests for a user
     * @param userAddr_ the user address to get pending requests for
     * @param offset_ the offset to start getting pending requests from
     * @param limit_ the maximum number of pending requests to return
     * @return The array of pending request IDs for the given user
     */
    function getUserPendingRequestsPart(
        address userAddr_,
        uint256 offset_,
        uint256 limit_
    ) external view returns (uint256[] memory);
}
