// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "@dlsl/dev-modules/contracts-registry/AbstractDependant.sol";
import "@dlsl/dev-modules/libs/decimals/DecimalsConverter.sol";
import "@dlsl/dev-modules/libs/arrays/Paginator.sol";
import "@dlsl/dev-modules/utils/Globals.sol";

import "./interfaces/IMarketplace.sol";
import "./interfaces/IRoleManager.sol";
import "./interfaces/IContractsRegistry.sol";
import "./interfaces/ITokenFactory.sol";
import "./interfaces/tokens/IERC721MintableToken.sol";

contract Marketplace is
    IMarketplace,
    ERC721Holder,
    AbstractDependant,
    EIP712Upgradeable,
    PausableUpgradeable
{
    using EnumerableSet for *;
    using DecimalsConverter for *;
    using Paginator for *;
    using SafeERC20 for IERC20;

    bytes32 internal constant _BUY_TYPEHASH =
        keccak256(
            "Buy(address tokenRecipient,address tokenContract,uint256 futureTokenId,address paymentTokenAddress,uint256 paymentTokenPrice,uint256 discount,uint256 endTimestamp,bytes32 tokenURI)"
        );
    bytes32 internal constant _BUY_WITH_REQUEST_TYPEHASH =
        keccak256(
            "BuyWithRequest(address tokenRecipient,uint256 requestId,uint256 futureTokenId,uint256 endTimestamp,bytes32 tokenURI)"
        );

    uint256 public nextRequestId;
    string public baseTokenContractsURI;

    IRoleManager internal _roleManager;
    ITokenFactory internal _tokenFactory;

    EnumerableSet.AddressSet internal _tokenContracts;
    EnumerableSet.UintSet internal _allPendingRequests;

    mapping(address => TokenParams) internal _tokenParams;
    mapping(address => EnumerableSet.UintSet) internal _userPendingRequests;
    mapping(uint256 => NFTRequestInfo) internal _nftRequests;
    mapping(address => mapping(uint256 => uint256)) internal _nftRequestsByNFTId;

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
        nextRequestId = 1;
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

    function setBaseTokenContractsURI(
        string memory baseTokenContractsURI_
    ) external override onlyMarketplaceManager {
        baseTokenContractsURI = baseTokenContractsURI_;

        emit BaseTokenContractsURIUpdated(baseTokenContractsURI_);
    }

    function addToken(
        string memory name_,
        string memory symbol_,
        TokenParams memory tokenParams_
    ) external override onlyMarketplaceManager returns (address tokenProxy_) {
        require(
            bytes(name_).length > 0 && bytes(symbol_).length > 0,
            "Marketplace: Token name or symbol is empty."
        );

        require(!tokenParams_.isDisabled, "Marketplace: Token can not be disabled on creation.");

        tokenProxy_ = _tokenFactory.deployToken(name_, symbol_);

        if (tokenParams_.isVoucherBuyable && tokenParams_.voucherTokenContract == address(0)) {
            tokenParams_.voucherTokenContract = _tokenFactory.deployVoucher(
                string.concat(name_, "_Voucher"),
                string.concat(symbol_, "_V")
            );
        }

        _validateVoucherParams(
            tokenParams_.isVoucherBuyable,
            tokenParams_.voucherTokensAmount,
            tokenParams_.voucherTokenContract
        );

        _tokenParams[tokenProxy_] = tokenParams_;
        _tokenContracts.add(tokenProxy_);

        emit TokenContractDeployed(tokenProxy_, name_, symbol_, tokenParams_);
    }

    function updateTokenParams(
        address tokenContract_,
        TokenParams memory newTokenParams_
    ) external override onlyMarketplaceManager {
        _checkTokenContractExists(tokenContract_);

        _validateVoucherParams(
            newTokenParams_.isVoucherBuyable,
            newTokenParams_.voucherTokensAmount,
            newTokenParams_.voucherTokenContract
        );

        _tokenParams[tokenContract_] = newTokenParams_;

        emit TokenParamsUpdated(tokenContract_, newTokenParams_);
    }

    function withdrawCurrency(
        address tokenAddr_,
        address recipient_,
        uint256 desiredAmount_,
        bool withdrawAll_
    ) external override onlyWithdrawalManager {
        bool isNativeCurrency_ = tokenAddr_ == address(0);

        uint256 amount_ = isNativeCurrency_
            ? address(this).balance
            : IERC20(tokenAddr_).balanceOf(address(this));

        if (!withdrawAll_) {
            amount_ = Math.min(amount_, desiredAmount_);
        }

        require(amount_ > 0, "Marketplace: Nothing to withdraw.");

        if (isNativeCurrency_) {
            _transferNativeCurrency(recipient_, amount_);
        } else {
            IERC20(tokenAddr_).safeTransfer(recipient_, amount_);

            amount_ = amount_.to18(tokenAddr_.decimals());
        }

        emit PaidTokensWithdrawn(tokenAddr_, recipient_, amount_);
    }

    function withdrawNFTs(
        IERC721 nft_,
        address recipient_,
        uint256[] memory tokenIds_
    ) external override onlyWithdrawalManager {
        for (uint256 i = 0; i < tokenIds_.length; i++) {
            require(
                _nftRequestsByNFTId[address(nft_)][tokenIds_[i]] == 0,
                "Marketplace: Can not withdraw NFT while it is in pending request."
            );
            _tranferNFT(nft_, address(this), recipient_, tokenIds_[i]);
        }

        emit NFTTokensWithdrawn(address(nft_), recipient_, tokenIds_);
    }

    function buyTokenWithETH(
        BuyParams memory buyParams_,
        SigData memory sig_
    ) external payable override whenNotPaused {
        _beforeBuyTokenCheck(buyParams_, sig_, PaymentType.NATIVE);

        require(
            buyParams_.paymentDetails.paymentTokenAddress == address(0),
            "Marketplace: Invalid payment token address."
        );

        TokenParams storage _currentTokenParams = _tokenParams[buyParams_.tokenContract];

        uint256 amountToPay_ = _getAmountToPay(
            buyParams_.paymentDetails,
            _currentTokenParams.pricePerOneToken
        );

        require(msg.value >= amountToPay_, "Marketplace: Invalid currency amount.");

        _transferNativeCurrency(
            _getFundsRecipient(_currentTokenParams.fundsRecipient),
            amountToPay_
        );

        uint256 extraCurrencyAmount_ = msg.value - amountToPay_;

        if (extraCurrencyAmount_ > 0) {
            _transferNativeCurrency(msg.sender, extraCurrencyAmount_);
        }

        _mintToken(
            buyParams_,
            PaymentType.NATIVE,
            _currentTokenParams.pricePerOneToken,
            amountToPay_
        );
    }

    function buyTokenWithERC20(
        BuyParams memory buyParams_,
        SigData memory sig_
    ) external override whenNotPaused {
        _beforeBuyTokenCheck(buyParams_, sig_, PaymentType.ERC20);

        TokenParams storage _currentTokenParams = _tokenParams[buyParams_.tokenContract];

        uint256 amountToPay_ = _getAmountToPay(
            buyParams_.paymentDetails,
            _currentTokenParams.pricePerOneToken
        );

        _transferERC20(
            buyParams_.paymentDetails.paymentTokenAddress,
            msg.sender,
            _currentTokenParams.fundsRecipient,
            amountToPay_
        );

        _mintToken(
            buyParams_,
            PaymentType.ERC20,
            _currentTokenParams.pricePerOneToken,
            amountToPay_
        );
    }

    function buyTokenWithVoucher(
        BuyParams memory buyParams_,
        SigData memory sig_,
        SigData memory permitSig_
    ) external override whenNotPaused {
        _beforeBuyTokenCheck(buyParams_, sig_, PaymentType.VOUCHER);

        TokenParams storage _currentTokenParams = _tokenParams[buyParams_.tokenContract];

        require(
            _currentTokenParams.isVoucherBuyable,
            "Marketplace: Unable to buy token with voucher."
        );
        require(
            buyParams_.paymentDetails.paymentTokenAddress ==
                _currentTokenParams.voucherTokenContract,
            "Marketplace: Invalid payment token address."
        );

        IERC20Permit(_currentTokenParams.voucherTokenContract).permit(
            buyParams_.recipient,
            address(this),
            _currentTokenParams.voucherTokensAmount,
            permitSig_.endSigTimestamp,
            permitSig_.v,
            permitSig_.r,
            permitSig_.s
        );

        _transferERC20(
            buyParams_.paymentDetails.paymentTokenAddress,
            buyParams_.recipient,
            _currentTokenParams.fundsRecipient,
            _currentTokenParams.voucherTokensAmount
        );

        _mintToken(
            buyParams_,
            PaymentType.VOUCHER,
            _currentTokenParams.pricePerOneToken,
            _currentTokenParams.voucherTokensAmount
        );
    }

    function buyTokenWithNFT(
        BuyParams memory buyParams_,
        SigData memory sig_
    ) external override whenNotPaused {
        _beforeBuyTokenCheck(buyParams_, sig_, PaymentType.NFT);

        TokenParams storage _currentTokenParams = _tokenParams[buyParams_.tokenContract];

        require(
            buyParams_.paymentDetails.paymentTokenPrice >= _currentTokenParams.minNFTFloorPrice,
            "Marketplace: NFT floor price is less than the minimal."
        );

        _tranferNFT(
            IERC721(buyParams_.paymentDetails.paymentTokenAddress),
            msg.sender,
            _getFundsRecipient(_currentTokenParams.fundsRecipient),
            buyParams_.paymentDetails.nftTokenId
        );

        _mintToken(buyParams_, PaymentType.NFT, _currentTokenParams.minNFTFloorPrice, 1);
    }

    function acceptRequest(
        AcceptRequestParams memory requestParams_,
        SigData memory sig_
    ) external override whenNotPaused {
        NFTRequestInfo storage _nftRequest = _nftRequests[requestParams_.requestId];

        _checkTokenAvailability(_nftRequest.tokenContract, true);

        _verifySignature(
            sig_,
            keccak256(
                abi.encode(
                    _BUY_WITH_REQUEST_TYPEHASH,
                    requestParams_.recipient,
                    requestParams_.requestId,
                    requestParams_.tokenData.tokenId,
                    sig_.endSigTimestamp,
                    keccak256(abi.encodePacked(requestParams_.tokenData.tokenURI))
                )
            )
        );

        _updateNFTRequestStatus(requestParams_.requestId, NFTRequestStatus.ACCEPTED);

        _tranferNFT(
            IERC721(_nftRequest.nftContract),
            address(this),
            _getFundsRecipient(_tokenParams[_nftRequest.tokenContract].fundsRecipient),
            _nftRequest.nftId
        );

        IERC721MintableToken(_nftRequest.tokenContract).mint(
            requestParams_.recipient,
            requestParams_.tokenData
        );

        emit TokenSuccessfullyExchanged(requestParams_, _nftRequest);
    }

    function createNFTRequest(
        address tokenContract_,
        address nftContract_,
        uint256 nftId_
    ) external whenNotPaused returns (uint256 requestId_) {
        _checkTokenAvailability(tokenContract_, true);

        _tranferNFT(IERC721(nftContract_), msg.sender, address(this), nftId_);

        requestId_ = nextRequestId++;

        _allPendingRequests.add(requestId_);
        _userPendingRequests[msg.sender].add(requestId_);

        _nftRequests[requestId_] = NFTRequestInfo(
            msg.sender,
            tokenContract_,
            nftContract_,
            nftId_,
            NFTRequestStatus.PENDING
        );

        _nftRequestsByNFTId[nftContract_][nftId_] = requestId_;

        emit NFTRequestCreated(requestId_, msg.sender, tokenContract_, nftContract_, nftId_);
    }

    function cancelNFTRequest(uint256 requestId_) external override {
        _updateNFTRequestStatus(requestId_, NFTRequestStatus.CANCELED);

        NFTRequestInfo storage _nftRequest = _nftRequests[requestId_];

        _tranferNFT(
            IERC721(_nftRequest.nftContract),
            address(this),
            msg.sender,
            _nftRequest.nftId
        );

        emit NFTRequestCanceled(requestId_);
    }

    function getTokenContractsCount() external view override returns (uint256) {
        return _tokenContracts.length();
    }

    function getActiveTokenContractsCount() external view override returns (uint256 count_) {
        uint256 tokenContractsCount_ = _tokenContracts.length();

        for (uint256 i = 0; i < tokenContractsCount_; i++) {
            if (!_tokenParams[_tokenContracts.at(i)].isDisabled) {
                count_++;
            }
        }
    }

    function getAllPendingRequestsCount() external view override returns (uint256) {
        return _allPendingRequests.length();
    }

    function getUserPendingRequestsCount(
        address userAddr_
    ) external view override returns (uint256) {
        return _userPendingRequests[userAddr_].length();
    }

    function getUserTokensPart(
        address userAddr_,
        uint256 offset_,
        uint256 limit_
    ) external view override returns (UserTokens[] memory userTokens_) {
        address[] memory _tokenContractsPart = _tokenContracts.part(offset_, limit_);

        userTokens_ = new UserTokens[](_tokenContractsPart.length);

        for (uint256 i = 0; i < _tokenContractsPart.length; i++) {
            userTokens_[i] = UserTokens(
                _tokenContractsPart[i],
                IERC721MintableToken(_tokenContractsPart[i]).getUserTokenIDs(userAddr_)
            );
        }
    }

    function getBriefTokenInfoPart(
        uint256 offset_,
        uint256 limit_
    ) external view override returns (BriefTokenInfo[] memory) {
        return getBriefTokenInfo(getTokenContractsPart(offset_, limit_));
    }

    function getDetailedTokenInfoPart(
        uint256 offset_,
        uint256 limit_
    ) external view override returns (DetailedTokenInfo[] memory) {
        return getDetailedTokenInfo(getTokenContractsPart(offset_, limit_));
    }

    function getBriefTokenInfo(
        address[] memory tokenContracts_
    ) public view override returns (BriefTokenInfo[] memory baseTokenParams_) {
        baseTokenParams_ = new BriefTokenInfo[](tokenContracts_.length);

        for (uint256 i; i < tokenContracts_.length; i++) {
            TokenParams storage _currentTokenParams = _tokenParams[tokenContracts_[i]];

            baseTokenParams_[i] = BriefTokenInfo(
                _getBaseTokenData(IERC721Metadata(tokenContracts_[i])),
                _currentTokenParams.pricePerOneToken,
                _currentTokenParams.isDisabled
            );
        }
    }

    function getDetailedTokenInfo(
        address[] memory tokenContracts_
    ) public view override returns (DetailedTokenInfo[] memory detailedTokenParams_) {
        detailedTokenParams_ = new DetailedTokenInfo[](tokenContracts_.length);

        for (uint256 i; i < tokenContracts_.length; i++) {
            detailedTokenParams_[i] = DetailedTokenInfo(
                _getBaseTokenData(IERC721Metadata(tokenContracts_[i])),
                _tokenParams[tokenContracts_[i]]
            );
        }
    }

    function getNFTRequestsInfo(
        uint256[] memory requestsId_
    ) public view override returns (NFTRequestInfo[] memory nftRequestsInfo_) {
        nftRequestsInfo_ = new NFTRequestInfo[](requestsId_.length);

        for (uint256 i; i < requestsId_.length; i++) {
            nftRequestsInfo_[i] = _nftRequests[requestsId_[i]];
        }
    }

    function getTokenContractsPart(
        uint256 offset_,
        uint256 limit_
    ) public view override returns (address[] memory) {
        return _tokenContracts.part(offset_, limit_);
    }

    function getPendingRequestsPart(
        uint256 offset_,
        uint256 limit_
    ) public view override returns (uint256[] memory) {
        return _allPendingRequests.part(offset_, limit_);
    }

    function getUserPendingRequestsPart(
        address userAddr_,
        uint256 offset_,
        uint256 limit_
    ) public view override returns (uint256[] memory) {
        return _userPendingRequests[userAddr_].part(offset_, limit_);
    }

    function _transferNativeCurrency(address recipient_, uint256 amountToSend_) internal {
        if (recipient_ != address(this)) {
            (bool success_, ) = recipient_.call{value: amountToSend_}("");

            require(success_, "Marketplace: Failed to send currency to the recipient.");
        }
    }

    function _transferERC20(
        address tokenAddr_,
        address sender_,
        address recipient_,
        uint256 amountToSend_
    ) internal {
        IERC20(tokenAddr_).safeTransferFrom(
            sender_,
            _getFundsRecipient(recipient_),
            amountToSend_.from18(tokenAddr_.decimals())
        );
    }

    function _tranferNFT(IERC721 nft_, address from_, address to_, uint256 nftId_) internal {
        if (from_ != to_) {
            require(nft_.ownerOf(nftId_) == from_, "Marketplace: Sender is not the owner.");

            nft_.safeTransferFrom(from_, to_, nftId_);
        }
    }

    function _mintToken(
        BuyParams memory buyParams_,
        PaymentType paymentType_,
        uint256 pricePerOneToken_,
        uint256 paidTokensAmount_
    ) internal {
        IERC721MintableToken(buyParams_.tokenContract).mint(
            buyParams_.recipient,
            buyParams_.tokenData
        );

        emit TokenSuccessfullyPurchased(
            pricePerOneToken_,
            paidTokensAmount_,
            buyParams_,
            paymentType_
        );
    }

    function _updateNFTRequestStatus(uint256 requestId_, NFTRequestStatus newStatus_) internal {
        NFTRequestInfo storage _nftRequest = _nftRequests[requestId_];

        require(_nftRequest.requester == msg.sender, "Marketplace: Sender is not the requester.");

        require(
            _nftRequest.status == NFTRequestStatus.PENDING,
            "Marketplace: Request status is not valid."
        );

        _nftRequest.status = newStatus_;

        _allPendingRequests.remove(requestId_);
        _userPendingRequests[msg.sender].remove(requestId_);
        delete _nftRequestsByNFTId[_nftRequest.nftContract][_nftRequest.nftId];
    }

    function _beforeBuyTokenCheck(
        BuyParams memory buyParams_,
        SigData memory sig_,
        PaymentType paymentType_
    ) internal view {
        _checkTokenAvailability(buyParams_.tokenContract, paymentType_ == PaymentType.NFT);

        _verifySignature(
            sig_,
            keccak256(
                abi.encode(
                    _BUY_TYPEHASH,
                    buyParams_.recipient,
                    buyParams_.tokenContract,
                    buyParams_.tokenData.tokenId,
                    buyParams_.paymentDetails.paymentTokenAddress,
                    buyParams_.paymentDetails.paymentTokenPrice,
                    buyParams_.paymentDetails.discount,
                    sig_.endSigTimestamp,
                    keccak256(abi.encodePacked(buyParams_.tokenData.tokenURI))
                )
            )
        );
    }

    function _verifySignature(SigData memory sig_, bytes32 structHash_) internal view {
        address signer_ = ECDSA.recover(_hashTypedDataV4(structHash_), sig_.v, sig_.r, sig_.s);

        require(_roleManager.isSignatureManager(signer_), "Marketplace: Invalid signature.");
        require(block.timestamp <= sig_.endSigTimestamp, "Marketplace: Signature expired.");
    }

    function _getFundsRecipient(address fundsRecipient_) internal view returns (address) {
        return fundsRecipient_ == address(0) ? address(this) : fundsRecipient_;
    }

    function _checkTokenAvailability(address tokenContract_, bool isNFTBuyOption_) internal view {
        _checkTokenContractExists(tokenContract_);

        TokenParams storage _currentTokenParams = _tokenParams[tokenContract_];

        require(!_currentTokenParams.isDisabled, "Marketplace: Token is disabled.");

        require(
            !isNFTBuyOption_ || _currentTokenParams.isNFTBuyable,
            "Marketplace: This token cannot be purchased with NFT."
        );
    }

    function _checkTokenContractExists(address tokenContract_) internal view {
        require(
            _tokenContracts.contains(tokenContract_),
            "Marketplace: Token contract not found."
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

    function _getBaseTokenData(
        IERC721Metadata tokenContract_
    ) internal view returns (BaseTokenData memory) {
        return
            BaseTokenData(address(tokenContract_), tokenContract_.name(), tokenContract_.symbol());
    }

    function _validateVoucherParams(
        bool isVoucherBuyable,
        uint256 voucherTokensAmount,
        address voucherAddress
    ) internal pure {
        require(
            !isVoucherBuyable || (voucherTokensAmount > 0 && voucherAddress != address(0)),
            "Marketplace: Invalid voucher params."
        );
    }

    function _getAmountToPay(
        PaymentDetails memory paymentDetails_,
        uint256 pricePerOneToken_
    ) internal pure returns (uint256) {
        uint256 amountWithoutDiscount_ = (pricePerOneToken_ * DECIMAL) /
            paymentDetails_.paymentTokenPrice;

        return
            (amountWithoutDiscount_ * (PERCENTAGE_100 - paymentDetails_.discount)) /
            PERCENTAGE_100;
    }
}
