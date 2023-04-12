// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

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
    using SafeERC20 for IERC20Metadata;

    bytes32 internal constant _BUY_TYPEHASH =
        keccak256(
            "Buy(address tokenContract,uint256 futureTokenId,address paymentTokenAddress,uint256 paymentTokenPrice,uint256 discount,uint256 endTimestamp,bytes32 tokenURI)"
        );

    string public baseTokenContractsURI;

    IRoleManager internal _roleManager;
    ITokenFactory internal _tokenFactory;

    EnumerableSet.AddressSet internal _tokenContracts;
    mapping(address => TokenParams) internal _tokenParams;

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
    ) external override whenNotPaused onlyMarketplaceManager {
        baseTokenContractsURI = baseTokenContractsURI_;

        emit BaseTokenContractsURIUpdated(baseTokenContractsURI_);
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
        IERC20Metadata token_ = IERC20Metadata(tokenAddr_);
        bool isNativeCurrency_ = tokenAddr_ == address(0);

        uint256 amount_ = isNativeCurrency_
            ? address(this).balance
            : token_.balanceOf(address(this));

        require(amount_ > 0, "Marketplace: Nothing to withdraw.");

        if (isNativeCurrency_) {
            _sendNativeCurrency(recipient_, amount_);
        } else {
            token_.safeTransfer(recipient_, amount_);

            amount_ = amount_.to18(token_.decimals());
        }

        emit PaidTokensWithdrawn(tokenAddr_, recipient_, amount_);
    }

    function buyTokenWithETH(
        BuyParams memory buyParams_,
        Sig memory sig_
    ) external payable whenNotPaused {
        _beforeBuyTokenCheck(buyParams_, sig_);

        require(
            buyParams_.paymentDetails.paymentTokenAddress == address(0),
            "Marketplace: Invalid payment token address"
        );

        TokenParams storage _currentTokenParams = _tokenParams[buyParams_.tokenContract];

        uint256 amountToPay_ = _getAmountToPay(
            buyParams_.paymentDetails,
            _currentTokenParams.pricePerOneToken
        );

        require(msg.value >= amountToPay_, "Marketplace: Invalid currency amount.");

        address fundsRecipient_ = _getFundsRecipient(_currentTokenParams.fundsRecipient);

        if (fundsRecipient_ != address(this)) {
            _sendNativeCurrency(fundsRecipient_, amountToPay_);
        }

        uint256 extraCurrencyAmount_ = msg.value - amountToPay_;

        if (extraCurrencyAmount_ > 0) {
            _sendNativeCurrency(msg.sender, extraCurrencyAmount_);
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
        Sig memory sig_
    ) external whenNotPaused {
        _beforeBuyTokenCheck(buyParams_, sig_);

        TokenParams storage _currentTokenParams = _tokenParams[buyParams_.tokenContract];

        uint256 amountToPay_ = _getAmountToPay(
            buyParams_.paymentDetails,
            _currentTokenParams.pricePerOneToken
        );

        _sendERC20(
            IERC20Metadata(buyParams_.paymentDetails.paymentTokenAddress),
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
        Sig memory sig_
    ) external whenNotPaused {
        _beforeBuyTokenCheck(buyParams_, sig_);

        TokenParams storage _currentTokenParams = _tokenParams[buyParams_.tokenContract];

        require(
            _currentTokenParams.voucherTokenContract != address(0),
            "Marketplace: Unable to buy token with voucher"
        );
        require(
            buyParams_.paymentDetails.paymentTokenAddress ==
                _currentTokenParams.voucherTokenContract,
            "Marketplace: Invalid payment token address"
        );

        _sendERC20(
            IERC20Metadata(buyParams_.paymentDetails.paymentTokenAddress),
            msg.sender,
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

    function buyTokenWithNFT(BuyParams memory buyParams_, Sig memory sig_) external whenNotPaused {
        _beforeBuyTokenCheck(buyParams_, sig_);

        TokenParams storage _currentTokenParams = _tokenParams[buyParams_.tokenContract];

        require(_currentTokenParams.isNFTBuyable, "Marketplace: Unable to buy token with NFT");

        require(
            buyParams_.paymentDetails.paymentTokenPrice >= _currentTokenParams.minNFTFloorPrice,
            "Marketplace: NFT floor price is less than the minimal."
        );

        IERC721 nft_ = IERC721(buyParams_.paymentDetails.paymentTokenAddress);

        require(
            nft_.ownerOf(buyParams_.paymentDetails.nftTokenId) == msg.sender,
            "Marketplace: Sender is not the owner."
        );

        nft_.safeTransferFrom(
            msg.sender,
            _getFundsRecipient(_currentTokenParams.fundsRecipient),
            buyParams_.paymentDetails.nftTokenId
        );

        _mintToken(buyParams_, PaymentType.NFT, _currentTokenParams.minNFTFloorPrice, 1);
    }

    function getUserTokenIDs(
        address tokenContract_,
        address userAddr_
    ) external view override returns (uint256[] memory tokenIDs_) {
        uint256 _tokensCount = IERC721(tokenContract_).balanceOf(userAddr_);

        tokenIDs_ = new uint256[](_tokensCount);

        for (uint256 i; i < _tokensCount; i++) {
            tokenIDs_[i] = IERC721Enumerable(tokenContract_).tokenOfOwnerByIndex(userAddr_, i);
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
                IERC721Metadata(tokenContract_[i]).name()
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
            detailedTokenParams_[i] = DetailedTokenParams(
                tokenContracts_[i],
                _tokenParams[tokenContracts_[i]],
                IERC721Metadata(tokenContracts_[i]).name(),
                IERC721Metadata(tokenContracts_[i]).symbol()
            );
        }
    }

    function getDetailedTokenParamsPart(
        uint256 offset_,
        uint256 limit_
    ) external view override returns (DetailedTokenParams[] memory) {
        return getDetailedTokenParams(getTokenContractsPart(offset_, limit_));
    }

    function _sendNativeCurrency(address recipient_, uint256 amountToSend_) internal {
        (bool success_, ) = recipient_.call{value: amountToSend_}("");

        require(success_, "Marketplace: Failed to send currency to the recipient.");
    }

    function _sendERC20(
        IERC20Metadata token_,
        address sender_,
        address recipient_,
        uint256 amountToSend_
    ) internal {
        token_.safeTransferFrom(
            sender_,
            _getFundsRecipient(recipient_),
            amountToSend_.from18(token_.decimals())
        );
    }

    function _mintToken(
        BuyParams memory buyParams_,
        PaymentType paymentType_,
        uint256 pricePerOneToken_,
        uint256 paidTokensAmount_
    ) internal {
        IERC721MintableToken(buyParams_.tokenContract).mint(
            msg.sender,
            buyParams_.futureTokenId,
            buyParams_.tokenURI
        );

        emit TokenSuccessfullyPurchased(
            msg.sender,
            pricePerOneToken_,
            paidTokensAmount_,
            buyParams_,
            paymentType_
        );
    }

    function _beforeBuyTokenCheck(BuyParams memory buyParams_, Sig memory sig_) internal view {
        require(
            _tokenContracts.contains(buyParams_.tokenContract),
            "Marketplace: Token contract not found."
        );

        TokenParams storage _currentTokenParams = _tokenParams[buyParams_.tokenContract];

        require(!_currentTokenParams.isDisabled, "Marketplace: Unable to buy disabled token");

        bytes32 structHash_ = keccak256(
            abi.encode(
                _BUY_TYPEHASH,
                buyParams_.tokenContract,
                buyParams_.futureTokenId,
                buyParams_.paymentDetails.paymentTokenAddress,
                buyParams_.paymentDetails.paymentTokenPrice,
                buyParams_.paymentDetails.discount,
                buyParams_.endTimestamp,
                keccak256(abi.encodePacked(buyParams_.tokenURI))
            )
        );

        address signer_ = ECDSA.recover(_hashTypedDataV4(structHash_), sig_.v, sig_.r, sig_.s);

        require(_roleManager.isSignatureManager(signer_), "Marketplace: Invalid signature.");
        require(block.timestamp <= buyParams_.endTimestamp, "Marketplace: Signature expired.");
    }

    function _getFundsRecipient(address fundsRecipient_) internal view returns (address) {
        return fundsRecipient_ == address(0) ? address(this) : fundsRecipient_;
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

    function _validateTokenParams(string memory name_, string memory symbol_) internal pure {
        require(
            bytes(name_).length > 0 && bytes(symbol_).length > 0,
            "Marketplace: Token name or symbol is empty."
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
