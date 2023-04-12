// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

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
     */
    enum PaymentType {
        NATIVE,
        ERC20,
        NFT,
        VOUCHER
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
     * @notice Struct representing the buying parameters for purchasing an NFT
     * @param paymentDetails the payment details for purchasing an NFT
     * @param tokenContract the contract address of the token used for payment
     * @param futureTokenId the ID of the future token
     * @param endTimestamp the timestamp when the purchase ends
     * @param tokenURI the URI of the token to be purchased
     */
    struct BuyParams {
        PaymentDetails paymentDetails;
        address tokenContract;
        uint256 futureTokenId;
        uint256 endTimestamp;
        string tokenURI;
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
     * @param r the r value of the signature
     * @param s the s value of the signature
     * @param v the v value of the signature
     */
    struct Sig {
        bytes32 r;
        bytes32 s;
        uint8 v;
    }

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
     * @notice Function that allows users to buy a token using Ether
     * @dev Requires the caller to send Ether to the contract for the purchase
     * @param buyParams_ the buying parameters used for purchasing the token
     * @param sig_ the signature for the purchasing
     */
    function buyTokenWithETH(BuyParams memory buyParams_, Sig memory sig_) external payable;

    /**
     * @notice Function that allows users to buy a token using an ERC20 token
     * @dev Requires the caller to approve the ERC20 token transfer to this contract before calling this function
     * @param buyParams_ the buying parameters used for purchasing the token
     * @param sig_ the signature for the purchasing
     */
    function buyTokenWithERC20(BuyParams memory buyParams_, Sig memory sig_) external;

    /**
     * @notice Function that allows users to buy a token using a voucher
     *
     * @param buyParams_ the buying parameters used for purchasing the token
     * @param sig_ the signature for the purchasing
     */
    function buyTokenWithVoucher(BuyParams memory buyParams_, Sig memory sig_) external;

    /**
     * @notice Function that allows users to buy an NFT token using an NFT
     * @dev Requires the caller to own the NFT used for payment
     * @param buyParams_ the buying parameters used for purchasing the token
     * @param sig_ the signature for the purchasing
     */
    function buyTokenWithNFT(BuyParams memory buyParams_, Sig memory sig_) external;

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
