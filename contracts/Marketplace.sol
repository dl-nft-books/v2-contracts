// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@dlsl/dev-modules/contracts-registry/AbstractDependant.sol";
import "@dlsl/dev-modules/libs/decimals/DecimalsConverter.sol";
import "@dlsl/dev-modules/utils/Globals.sol";

import "./interfaces/IMarketplace.sol";
import "./interfaces/IRoleManager.sol";
import "./interfaces/IContractsRegistry.sol";
import "./interfaces/ITokenFactory.sol";
import "./interfaces/tokens/IERC721MintableToken.sol";

contract Marketplace is IMarketplace, AbstractDependant, EIP712Upgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using DecimalsConverter for uint256;
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;

    bytes32 internal constant _MINT_TYPEHASH =
        keccak256(
            "Mint(address paymentTokenAddress,uint256 paymentTokenPrice,uint256 discount,uint256 endTimestamp,bytes32 tokenURI)"
        );

    IRoleManager private _roleManager;
    ITokenFactory private _tokenFactory;

    EnumerableSet.AddressSet internal _tokenContracts;
    mapping(address => TokenParams) public tokenParams;

    modifier onlyAdministrator() {
        _onlyAdministrator();
        _;
    }

    function __Marketplace_init() external override initializer {
        // __EIP712_init("Marketplace", "1");
        // __ReentrancyGuard_init();
    }

    function setDependencies(
        address contractsRegistry_,
        bytes calldata
    ) external override dependant {
        IContractsRegistry registry_ = IContractsRegistry(contractsRegistry_);

        _roleManager = IRoleManager(registry_.getRoleManagerContract());
        _tokenFactory = ITokenFactory(registry_.getTokenFactoryContract());
    }

    function updateTokenContractParams(
        address tokenContract_,
        uint256 newPrice_,
        uint256 newMinNFTFloorPrice_,
        string memory newTokenName_,
        string memory newTokenSymbol_
    ) external override onlyAdministrator {
        _updateTokenContractParams(
            tokenContract_,
            newPrice_,
            newMinNFTFloorPrice_,
            newTokenName_,
            newTokenSymbol_
        );
    }

    function updateVoucherParams(address tokenContract_, address newVoucherTokenContract_, uint256 newVoucherTokensAmount_)
        external
        override
        onlyAdministrator
    {
        _updateVoucherParams(tokenContract_, newVoucherTokenContract_, newVoucherTokensAmount_);
    }

    function deployToken(
        string calldata name_,
        string calldata symbol_,
        uint256 pricePerOneToken_
    ) external onlyAdministrator returns (address tokenProxy) {
        tokenProxy = _tokenFactory.deployToken(
            name_,
            symbol_
        );
        _tokenContracts.add(tokenProxy);
    }

    function updateAllParams(
        address tokenContract_,
        uint256 newPrice_,
        uint256 newMinNFTFloorPrice_,
        address newVoucherTokenContract_,
        uint256 newVoucherTokensAmount_,
        string memory newTokenName_,
        string memory newTokenSymbol_
    ) external override onlyAdministrator {
        _updateTokenContractParams(
            tokenContract_,
            newPrice_,
            newMinNFTFloorPrice_,
            newTokenName_,
            newTokenSymbol_
        );
        _updateVoucherParams(tokenContract_, newVoucherTokenContract_, newVoucherTokensAmount_);
    }

    // TODO: when not paused?; nonReentrant?
    function mintToken(
        address tokenContract_, // added
        address paymentTokenAddress_,
        uint256 paymentTokenPrice_,
        uint256 discount_,
        uint256 endTimestamp_,
        string memory tokenURI_,
        bytes32 r_,
        bytes32 s_,
        uint8 v_
    ) external payable {
        _verifySignature(
            tokenContract_,
            paymentTokenAddress_,
            paymentTokenPrice_,
            discount_,
            endTimestamp_,
            tokenURI_,
            r_,
            s_,
            v_
        );

        uint256 amountToPay_;

        if (paymentTokenPrice_ != 0 || paymentTokenAddress_ != address(0)) {
            if (paymentTokenAddress_ == address(0)) {
                amountToPay_ = _payWithETH(tokenContract_, paymentTokenPrice_, discount_);
            } else {
                amountToPay_ = _payWithERC20(
                    tokenContract_,
                    IERC20MetadataUpgradeable(paymentTokenAddress_),
                    paymentTokenPrice_,
                    discount_
                );
            }
        }

        // TODO: how to name it?
        TokenParams storage currentTokenParams = tokenParams[tokenContract_];

        uint256 currentTokenId_ = currentTokenParams.tokenId++;
        _mintToken(tokenContract_, currentTokenId_, tokenURI_);

        emit SuccessfullyMinted(
            tokenContract_,
            msg.sender,
            MintedTokenInfo(currentTokenId_, currentTokenParams.pricePerOneToken, tokenURI_),
            paymentTokenAddress_,
            amountToPay_,
            paymentTokenPrice_,
            discount_
        );
    }

    function mintTokenByNFT(
        address tokenContract_, // added
        address nftAddress_,
        uint256 nftFloorPrice_,
        uint256 tokenId_,
        uint256 endTimestamp_,
        string memory tokenURI_,
        bytes32 r_,
        bytes32 s_,
        uint8 v_
    ) external override  {
        _verifySignature(
            tokenContract_,
            nftAddress_,
            nftFloorPrice_,
            0, // Discount is zero for NFT by NFT option
            endTimestamp_,
            tokenURI_,
            r_,
            s_,
            v_
        );

        _payWithNFT(tokenContract_, IERC721Upgradeable(nftAddress_), nftFloorPrice_, tokenId_);

        // TODO: how to name it?
        TokenParams storage currentTokenParams = tokenParams[tokenContract_];

        uint256 currentTokenId_ = currentTokenParams.tokenId++;
        _mintToken(tokenContract_, currentTokenId_, tokenURI_);

        emit SuccessfullyMintedByNFT(
            tokenContract_,
            msg.sender,
            MintedTokenInfo(currentTokenId_, currentTokenParams.minNFTFloorPrice, tokenURI_),
            nftAddress_,
            tokenId_,
            nftFloorPrice_
        );
    }

    // function getUserTokenIDs(address tokenContract_,address userAddr_)
    //     external
    //     view
    //     override
    //     returns (uint256[] memory tokenIDs_)
    // {
    //     uint256 _tokensCount = balanceOf(userAddr_);

    //     tokenIDs_ = new uint256[](_tokensCount);

    //     for (uint256 i; i < _tokensCount; i++) {
    //         tokenIDs_[i] = tokenOfOwnerByIndex(userAddr_, i);
    //     }
    // }

    function _updateTokenContractParams(
        address tokenContract_,
        uint256 newPrice_,
        uint256 newMinNFTFloorPrice_,
        string memory newTokenName_,
        string memory newTokenSymbol_
    ) internal {
        // TODO: how to name it?
        TokenParams storage currentTokenParams = tokenParams[tokenContract_];

        currentTokenParams.pricePerOneToken = newPrice_;
        currentTokenParams.minNFTFloorPrice = newMinNFTFloorPrice_;

        currentTokenParams.tokenName = newTokenName_;
        currentTokenParams.tokenSymbol = newTokenSymbol_;

        emit TokenContractParamsUpdated(
            tokenContract_,
            newPrice_,
            newMinNFTFloorPrice_,
            newTokenName_,
            newTokenSymbol_
        );
    }

    function _updateVoucherParams(
        address tokenContract_,
        address newVoucherTokenContract_,
        uint256 newVoucherTokensAmount_
    ) internal {
        // TODO: how to name it?
        TokenParams storage currentTokenParams = tokenParams[tokenContract_];

        currentTokenParams.voucherTokenContract = newVoucherTokenContract_;
        currentTokenParams.voucherTokensAmount = newVoucherTokensAmount_;

        emit VoucherParamsUpdated(tokenContract_, newVoucherTokenContract_, newVoucherTokensAmount_);
    }

    function _payWithERC20(
        address tokenContract_,
        IERC20MetadataUpgradeable tokenAddr_,
        uint256 tokenPrice_,
        uint256 discount_
    ) internal returns (uint256) {
        require(msg.value == 0, "Marketplace: Currency amount must be a zero.");

        // TODO: how to name it?
        TokenParams storage currentTokenParams = tokenParams[tokenContract_];

        uint256 amountToPay_ = tokenPrice_ != 0
            ? _getAmountAfterDiscount((currentTokenParams.pricePerOneToken * DECIMAL) / tokenPrice_, discount_)
            : currentTokenParams.voucherTokensAmount;

        tokenAddr_.safeTransferFrom(
            msg.sender,
            address(this),
            amountToPay_.from18(tokenAddr_.decimals())
        );

        return amountToPay_;
    }

    function _payWithETH(address tokenContract_, uint256 ethPrice_, uint256 discount_) internal returns (uint256) {
        uint256 amountToPay_ = _getAmountAfterDiscount(
            (tokenParams[tokenContract_].pricePerOneToken * DECIMAL) / ethPrice_,
            discount_
        );

        require(msg.value >= amountToPay_, "Marketplace: Invalid currency amount.");

        uint256 extraCurrencyAmount_ = msg.value - amountToPay_;

        if (extraCurrencyAmount_ > 0) {
            (bool success_, ) = msg.sender.call{value: extraCurrencyAmount_}("");
            require(success_, "Marketplace: Failed to return currency.");
        }

        return amountToPay_;
    }

    function _payWithNFT(
        address tokenContract_,
        IERC721Upgradeable nft_,
        uint256 nftFloorPrice_,
        uint256 tokenId_
    ) internal {
        require(
            nftFloorPrice_ >= tokenParams[tokenContract_].minNFTFloorPrice,
            "Marketplace: NFT floor price is less than the minimal."
        );
        require(
            IERC721Upgradeable(nft_).ownerOf(tokenId_) == msg.sender,
            "Marketplace: Sender is not the owner."
        );

        nft_.safeTransferFrom(msg.sender, address(this), tokenId_);
    }

    function _mintToken(address tokenContract_, uint256 mintTokenId_, string memory tokenURI_) internal {
        // _mint(msg.sender, mintTokenId_);

        // _tokenURIs[mintTokenId_] = tokenURI_;
        // existingTokenURIs[tokenURI_] = true;
        

        // IERC721MintableToken(tokenContract_).mint(msg.sender, currentTokenId_, tokenURI_);
    }

    function _verifySignature(
        address tokenContract_,
        address paymentTokenAddress_,
        uint256 paymentTokenPrice_,
        uint256 discount_,
        uint256 endTimestamp_,
        string memory tokenURI_,
        bytes32 r_,
        bytes32 s_,
        uint8 v_
    ) internal view {
        require(!tokenParams[tokenContract_].existingTokenURIs[tokenURI_], "Marketplace: Token URI already exists.");

        bytes32 structHash_ = keccak256(
            abi.encode(
                _MINT_TYPEHASH,
                paymentTokenAddress_,
                paymentTokenPrice_,
                discount_,
                endTimestamp_,
                keccak256(abi.encodePacked(tokenURI_))
            )
        );

        address signer_ = ECDSAUpgradeable.recover(_hashTypedDataV4(structHash_), v_, r_, s_);

        require(_roleManager.isAdmin(signer_), "Marketplace: Invalid signature.");
        require(block.timestamp <= endTimestamp_, "Marketplace: Signature expired.");
    }
    

    function _baseURI(address tokenContract_) internal view returns (string memory) {
        return tokenParams[tokenContract_].baseTokenURI;
    }

    // function _EIP712NameHash() internal view override returns (bytes32) {
    //     return keccak256(bytes(_tokenName));
    // }

    function _onlyAdministrator() internal view {
        require(
            _roleManager.isAdmin(msg.sender),
            "Marketplace: Caller is not an Administrator"
        );
    }

    function _getAmountAfterDiscount(
        uint256 amount_,
        uint256 discount_
    ) internal pure returns (uint256) {
        return (amount_ * (PERCENTAGE_100 - discount_)) / PERCENTAGE_100;
    }
}
