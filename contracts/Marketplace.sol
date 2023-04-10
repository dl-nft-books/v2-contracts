// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "@dlsl/dev-modules/contracts-registry/AbstractDependant.sol";
import "@dlsl/dev-modules/utils/Globals.sol";
import "@dlsl/dev-modules/libs/decimals/DecimalsConverter.sol";
import "@dlsl/dev-modules/libs/arrays/Paginator.sol";

import "./interfaces/IMarketplace.sol";
import "./interfaces/IRoleManager.sol";
import "./interfaces/IContractsRegistry.sol";
import "./interfaces/ITokenFactory.sol";
import "./interfaces/tokens/IERC721MintableToken.sol";

contract Marketplace is
    IMarketplace,
    ERC721HolderUpgradeable,
    AbstractDependant,
    EIP712Upgradeable,
    PausableUpgradeable
{
    using EnumerableSet for EnumerableSet.AddressSet;
    using Paginator for EnumerableSet.AddressSet;
    using DecimalsConverter for uint256;
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;

    uint256 internal _nextRequestId;
    string public baseTokenContractsURI;

    bytes32 internal constant _BUY_TYPEHASH =
        keccak256(
            "Buy(address tokenContract,uint256 futureTokenId,address paymentTokenAddress,uint256 paymentTokenPrice,uint256 discount,uint256 endTimestamp,bytes32 tokenURI)"
        );
    bytes32 internal constant _BUY_WITH_REQUEST = 
        keccak256(
            "BuyWithRequest(uint256 requestId,uint256 futureTokenId,uint256 endTimestamp,bytes32 tokenURI)"
        );

    EnumerableSet.AddressSet internal _tokenContracts;
    mapping(address => TokenParams) internal _tokenParams;

    NFTRequestInfo[] internal _nftRequests;

    IRoleManager private _roleManager;
    ITokenFactory private _tokenFactory;

    modifier onlyMarketplaceManager() {
        _onlyMarketplaceManager();
        _;
    }

    modifier onlyWithdrawalManager() {
        _onlyWithdrawalManager();
        _;
    }

    function __Marketplace_init(
        string memory baseTokenContractsURI_
    ) external override initializer {
        __EIP712_init("Marketplace", "1");

        baseTokenContractsURI = baseTokenContractsURI_;
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

    function pause() external override onlyMarketplaceManager {
        _pause();
    }

    function unpause() external override onlyMarketplaceManager {
        _unpause();
    }

    function addToken(
        string memory name_,
        string memory symbol_,
        TokenParams memory tokenParams_
    ) external whenNotPaused onlyMarketplaceManager returns (address tokenProxy_) {
        _validateTokenParams(name_, symbol_);

        require(!tokenParams_.isDisabled, "Marketplace: Token can not be disabled on creation.");

        tokenProxy_ = _tokenFactory.deployToken(name_, symbol_);

        _tokenParams[tokenProxy_] = tokenParams_;

        _tokenContracts.add(tokenProxy_);

        emit TokenContractDeployed(tokenProxy_, name_, symbol_, tokenParams_);
    }

    function updateAllParams(
        address tokenContract_,
        string memory name_,
        string memory symbol_,
        TokenParams memory newTokenParams_
    ) external override whenNotPaused onlyMarketplaceManager {
        require(
            _tokenContracts.contains(tokenContract_),
            "Marketplace: Token contract not found."
        );

        _validateTokenParams(name_, symbol_);

        _tokenParams[tokenContract_] = newTokenParams_;

        IERC721MintableToken(tokenContract_).updateTokenParams(name_, symbol_);

        emit TokenContractParamsUpdated(tokenContract_, name_, symbol_, newTokenParams_);
    }

    function withdrawCurrency(
        address tokenAddr_,
        address recipient_
    ) external override onlyWithdrawalManager {
        bool isNativeCurrency_ = tokenAddr_ == address(0);

        IERC20MetadataUpgradeable token_ = IERC20MetadataUpgradeable(tokenAddr_);
        uint256 amount_ = isNativeCurrency_
            ? address(this).balance
            : token_.balanceOf(address(this));

        require(amount_ > 0, "Marketplace: Nothing to withdraw.");

        if (isNativeCurrency_) {
            (bool success_, ) = recipient_.call{value: amount_}("");
            require(success_, "Marketplace: Failed to transfer native currency.");
        } else {
            token_.safeTransfer(recipient_, amount_);

            amount_ = amount_.to18(token_.decimals());
        }

        emit PaidTokensWithdrawn(tokenAddr_, recipient_, amount_);
    }

    // TODO: nonReentrant?
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
    ) external payable whenNotPaused {
        _verifySignature(
            tokenContract_,
            futureTokenId_,
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

        TokenParams storage _currentTokenParams = _tokenParams[tokenContract_];

        _mintToken(tokenContract_, futureTokenId_, tokenURI_);
        MintedTokenInfo memory mintedTokenInfo = MintedTokenInfo(
            futureTokenId_,
            _currentTokenParams.pricePerOneToken,
            tokenURI_
        );

        emit SuccessfullyMinted(
            tokenContract_,
            msg.sender,
            mintedTokenInfo,
            paymentTokenAddress_,
            amountToPay_,
            paymentTokenPrice_,
            discount_,
            _currentTokenParams.fundsRecipient
        );
    }

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
    ) external override whenNotPaused {
        TokenParams storage _currentTokenParams = _tokenParams[tokenContract_];

        require(
            _currentTokenParams.isNFTBuyable,
            "Marketplace: This token cannot be purchased with NFT."
        );

        _verifySignature(
            tokenContract_,
            futureTokenId_,
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

        _mintToken(tokenContract_, futureTokenId_, tokenURI_);

        emit SuccessfullyMintedByNFT(
            tokenContract_,
            msg.sender,
            MintedTokenInfo(futureTokenId_, _currentTokenParams.minNFTFloorPrice, tokenURI_),
            nftAddress_,
            tokenId_,
            nftFloorPrice_,
            _currentTokenParams.fundsRecipient
        );
    }

    function createNFTRequest(
        address nftContract_,
        uint256 nftId_,
        address tokenContract_
    ) external returns (uint256 requestId_) {
        require(
            _tokenContracts.contains(tokenContract_),
            "Marketplace: Token contract not found."
        );

        TokenParams storage _currentTokenParams = _tokenParams[tokenContract_];

        require(
            !_currentTokenParams.isDisabled,
            "Marketplace: Token is disabled."
        );

        require(
            _currentTokenParams.isNFTBuyable,
            "Marketplace: This token cannot be purchased with NFT."
        );

        require(
            IERC721Upgradeable(nftContract_).ownerOf(nftId_) == msg.sender,
            "Marketplace: Sender is not the owner."
        );

        IERC721Upgradeable(nftContract_).safeTransferFrom(
            msg.sender,
            address(this),
            nftId_);

        requestId_ = _nftRequests.length;
        
        _nftRequests.push(
            NFTRequestInfo(
                tokenContract_,
                nftContract_,
                nftId_,
                msg.sender,
                NFTRequestStatus.PENDING
            )
        );

        emit NFTRequestCreated(requestId_, msg.sender, nftContract_, nftId_, tokenContract_);
    }

    function cancelNFTRequest(
        uint256 requestId_
    ) external {
        _checkNFTRequestAllowing(requestId_);

        NFTRequestInfo storage _nftRequest = _nftRequests[requestId_];

        _nftRequest.status = NFTRequestStatus.CANCELED;

        IERC721Upgradeable(_nftRequest.nftContract).safeTransferFrom(
            address(this),
            msg.sender,
            _nftRequest.nftId
        );

        emit NFTRequestCanceled(requestId_);
    }

    function buyTokenWithRequest(
        uint256 requestId_,
        uint256 futureTokenId_,
        uint256 endTimestamp_,
        string memory tokenURI_,
        bytes32 r_,
        bytes32 s_,
        uint8 v_
    ) external {
        // Do we need to check all the params?
        _checkNFTRequestAllowing(requestId_);
         
        NFTRequestInfo storage _nftRequest = _nftRequests[requestId_];

        TokenParams storage _currentTokenParams = _tokenParams[_nftRequest.tokenContract];

        _verifySignature(
            requestId_,
            futureTokenId_,
            endTimestamp_,
            tokenURI_,
            r_,
            s_,
            v_
        );

        if(_currentTokenParams.fundsRecipient != address(0) && _currentTokenParams.fundsRecipient != address(this)) {
            IERC721Upgradeable(_nftRequest.nftContract).safeTransferFrom(
                address(this),
                _currentTokenParams.fundsRecipient,
                _nftRequest.nftId
            );
        }

        _mintToken(_nftRequest.tokenContract, futureTokenId_, tokenURI_);

        emit SuccessfullyMintedWithRequest(
            _nftRequest.tokenContract,
            requestId_,
            msg.sender,
            MintedTokenInfo(futureTokenId_, 0, tokenURI_),
            _nftRequest.nftContract,
            _nftRequest.nftId,
            _currentTokenParams.fundsRecipient
        );

        _nftRequest.status = NFTRequestStatus.MINTED;
    }

    function setBaseTokenContractsURI(
        string memory baseTokenContractsURI_
    ) external override whenNotPaused onlyMarketplaceManager {
        baseTokenContractsURI = baseTokenContractsURI_;

        emit BaseTokenContractsURIUpdated(baseTokenContractsURI_);
    }

    function _payWithERC20(
        address tokenContract_,
        IERC20MetadataUpgradeable tokenAddr_,
        uint256 tokenPrice_,
        uint256 discount_
    ) internal returns (uint256) {
        require(msg.value == 0, "Marketplace: Currency amount must be a zero.");

        TokenParams storage _currentTokenParams = _tokenParams[tokenContract_];

        uint256 amountToPay_ = tokenPrice_ != 0
            ? _getAmountAfterDiscount(
                (_currentTokenParams.pricePerOneToken * DECIMAL) / tokenPrice_,
                discount_
            )
            : _currentTokenParams.voucherTokensAmount;

        tokenAddr_.safeTransferFrom(
            msg.sender,
            _currentTokenParams.fundsRecipient == address(0)
                ? address(this)
                : _currentTokenParams.fundsRecipient,
            amountToPay_.from18(tokenAddr_.decimals())
        );

        return amountToPay_;
    }

    function _payWithETH(
        address tokenContract_,
        uint256 ethPrice_,
        uint256 discount_
    ) internal returns (uint256) {
        TokenParams storage _currentTokenParams = _tokenParams[tokenContract_];

        uint256 amountToPay_ = _getAmountAfterDiscount(
            (_currentTokenParams.pricePerOneToken * DECIMAL) / ethPrice_,
            discount_
        );

        require(msg.value >= amountToPay_, "Marketplace: Invalid currency amount.");

        if (
            _currentTokenParams.fundsRecipient != address(0) &&
            _currentTokenParams.fundsRecipient != address(this)
        ) {
            (bool success_, ) = _currentTokenParams.fundsRecipient.call{value: amountToPay_}("");
            require(success_, "Marketplace: Failed to send currency to recipient.");
        }

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
        TokenParams storage _currentTokenParams = _tokenParams[tokenContract_];

        require(
            nftFloorPrice_ >= _currentTokenParams.minNFTFloorPrice,
            "Marketplace: NFT floor price is less than the minimal."
        );
        require(
            IERC721Upgradeable(nft_).ownerOf(tokenId_) == msg.sender,
            "Marketplace: Sender is not the owner."
        );

        nft_.safeTransferFrom(
            msg.sender,
            _currentTokenParams.fundsRecipient == address(0)
                ? address(this)
                : _currentTokenParams.fundsRecipient,
            tokenId_
        );
    }

    function _mintToken(
        address tokenContract_,
        uint256 mintTokenId_,
        string memory tokenURI_
    ) internal {
        IERC721MintableToken(tokenContract_).mint(msg.sender, mintTokenId_, tokenURI_);
    }

    function getUserTokenIDs(
        address tokenContract_,
        address userAddr_
    ) external view override returns (uint256[] memory tokenIDs_) {
        uint256 _tokensCount = IERC721Upgradeable(tokenContract_).balanceOf(userAddr_);

        tokenIDs_ = new uint256[](_tokensCount);

        for (uint256 i; i < _tokensCount; i++) {
            tokenIDs_[i] = IERC721EnumerableUpgradeable(tokenContract_).tokenOfOwnerByIndex(
                userAddr_,
                i
            );
        }
    }

    function getTokenContractsCount() external view override returns (uint256) {
        return _tokenContracts.length();
    }

    function getActiveTokenContractsCount() external view override returns (uint256 count_) {
        for (uint256 i = 0; i < _tokenContracts.length(); i++) {
            if (!_tokenParams[_tokenContracts.at(i)].isDisabled) {
                count_++;
            }
        }
    }

    function getTokenContractsPart(
        uint256 offset_,
        uint256 limit_
    ) public view override returns (address[] memory) {
        return _tokenContracts.part(offset_, limit_);
    }

    function getBaseTokenParams(
        address[] memory tokenContract_
    ) public view override returns (BaseTokenParams[] memory baseTokenParams_) {
        baseTokenParams_ = new BaseTokenParams[](tokenContract_.length);
        for (uint256 i; i < tokenContract_.length; i++) {
            TokenParams memory _currentTokenParams = _tokenParams[tokenContract_[i]];
            baseTokenParams_[i] = BaseTokenParams(
                tokenContract_[i],
                _currentTokenParams.isDisabled,
                _currentTokenParams.pricePerOneToken,
                ERC721Upgradeable(tokenContract_[i]).name()
            );
        }
    }

    function getBaseTokenParamsPart(
        uint256 offset_,
        uint256 limit_
    ) external view override returns (BaseTokenParams[] memory) {
        return getBaseTokenParams(getTokenContractsPart(offset_, limit_));
    }

    function getDetailedTokenParams(
        address[] memory tokenContracts_
    ) public view override returns (DetailedTokenParams[] memory detailedTokenParams_) {
        detailedTokenParams_ = new DetailedTokenParams[](tokenContracts_.length);

        for (uint256 i; i < tokenContracts_.length; i++) {
            TokenParams memory _currentTokenParams = _tokenParams[tokenContracts_[i]];
            detailedTokenParams_[i] = DetailedTokenParams(
                tokenContracts_[i],
                TokenParams(
                    _currentTokenParams.pricePerOneToken,
                    _currentTokenParams.minNFTFloorPrice,
                    _currentTokenParams.voucherTokensAmount,
                    _currentTokenParams.voucherTokenContract,
                    _currentTokenParams.fundsRecipient,
                    _currentTokenParams.isNFTBuyable,
                    _currentTokenParams.isDisabled
                ),
                ERC721Upgradeable(tokenContracts_[i]).name(),
                ERC721Upgradeable(tokenContracts_[i]).symbol()
            );
        }
    }

    function getDetailedTokenParamsPart(
        uint256 offset_,
        uint256 limit_
    ) external view override returns (DetailedTokenParams[] memory) {
        return getDetailedTokenParams(getTokenContractsPart(offset_, limit_));
    }

    function getNFTRequestsCount() external view override returns (uint256) {
        return _nftRequests.length;
    }

    function getNFTRequestsPart(
        uint256 offset_,
        uint256 limit_
    ) external view override returns (NFTRequestInfo[] memory nftRequests_) {
        uint256 to_ = _handleIncomingParametersForPart(_nftRequests.length, offset_, limit_);
        nftRequests_ = new NFTRequestInfo[](to_ - offset_);

        for (uint256 i = offset_; i < to_; i++) {
            nftRequests_[i - offset_] = _nftRequests[i];
        }

    }

    function _verifySignature(
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
    ) internal view {
        bytes32 structHash_ = keccak256(
            abi.encode(
                _BUY_TYPEHASH,
                tokenContract_,
                futureTokenId_,
                paymentTokenAddress_,
                paymentTokenPrice_,
                discount_,
                endTimestamp_,
                keccak256(abi.encodePacked(tokenURI_))
            )
        );

        address signer_ = ECDSAUpgradeable.recover(_hashTypedDataV4(structHash_), v_, r_, s_);

        require(_roleManager.isSignatureManager(signer_), "Marketplace: Invalid signature.");
        require(block.timestamp <= endTimestamp_, "Marketplace: Signature expired.");
    }

    function _verifySignature(
            uint256 requestId_,
            uint256 futureTokenId_,
            uint256 endTimestamp_,
            string memory tokenURI_,
            bytes32 r_,
            bytes32 s_,
            uint8 v_
        ) internal view {
            bytes32 structHash_ = keccak256(
                abi.encode(
                    _BUY_WITH_REQUEST,
                    requestId_,
                    futureTokenId_,
                    endTimestamp_,
                    keccak256(abi.encodePacked(tokenURI_))
                )
            );

            address signer_ = ECDSAUpgradeable.recover(_hashTypedDataV4(structHash_), v_, r_, s_);

            require(_roleManager.isSignatureManager(signer_), "Marketplace: Invalid signature.");
            require(block.timestamp <= endTimestamp_, "Marketplace: Signature expired.");
        }

    function _validateTokenParams(string memory name_, string memory symbol_) internal pure {
        require(
            bytes(name_).length > 0 && bytes(symbol_).length > 0,
            "Marketplace: Token name or symbol is empty."
        );
    }

    

    function _checkNFTRequestAllowing(
        uint256 requestId_
    ) internal view {
        require(
            requestId_ < _nftRequests.length,
            "Marketplace: Request ID is not valid."
        );
        
        NFTRequestInfo storage nftRequest = _nftRequests[requestId_];

        require(
            nftRequest.requester == msg.sender,
            "Marketplace: Sender is not the requester."
        );

        TokenParams storage _currentTokenParams = _tokenParams[nftRequest.tokenContract];
        
        require(
            !_currentTokenParams.isDisabled,
            "Marketplace: Token is disabled."
        );

        require(
            _currentTokenParams.isNFTBuyable,
            "Marketplace: This token cannot be purchased with NFT."
        );

        require(
            nftRequest.status == NFTRequestStatus.PENDING,
            "Marketplace: Request status is not valid."
        );
    }

    function _onlyMarketplaceManager() internal view {
        require(
            _roleManager.isMarketplaceManager(msg.sender),
            "Marketplace: Caller is not a marketplace manager."
        );
    }

    function _onlyWithdrawalManager() internal view {
        require(
            _roleManager.isWithdrawalManager(msg.sender),
            "Marketplace: Caller is not a withdrawal manager."
        );
    }

    function _getAmountAfterDiscount(
        uint256 amount_,
        uint256 discount_
    ) internal pure returns (uint256) {
        return (amount_ * (PERCENTAGE_100 - discount_)) / PERCENTAGE_100;
    }

    function _handleIncomingParametersForPart(
        uint256 length_,
        uint256 offset_,
        uint256 limit_
    ) private pure returns (uint256 to_) {
        to_ = offset_ + limit_;

        if (to_ > length_) {
            to_ = length_;
        }

        if (offset_ > to_) {
            to_ = offset_;
        }
    }
}
