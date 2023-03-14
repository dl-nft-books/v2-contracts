// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@dlsl/dev-modules/contracts-registry/AbstractDependant.sol";
import "@dlsl/dev-modules/utils/Globals.sol";

import "@dlsl/dev-modules/libs/decimals/DecimalsConverter.sol";

import "../interfaces/tokens/IERC721MintableToken.sol";
import "../interfaces/IRoleManager.sol";
import "../ContractsRegistry.sol";

contract ERC721MintableToken is
    IERC721MintableToken,
    AbstractDependant,
    ERC721EnumerableUpgradeable,
    ERC721HolderUpgradeable,
    EIP712Upgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using DecimalsConverter for uint256;    
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;

    bytes32 internal constant _MINT_TYPEHASH =
        keccak256(
            "Mint(address paymentTokenAddress,uint256 paymentTokenPrice,uint256 discount,uint256 endTimestamp,bytes32 tokenURI)"
        );

    mapping(string => bool) private _existingTokenURIs;
    mapping(uint256 => string) private _tokenURIs;

    uint256 public override pricePerOneToken;

    uint256 internal _tokenId;
    string internal _tokenName;
    string internal _tokenSymbol;

    address private _roleManager;
    address private _tokenFactory;
    address private _marketplace;

    modifier onlyMarketplace() {
        _onlyMarketplace();
        _;
    }

    modifier onlyAdministrator() {
        _onlyAdministrator();
        _;
    }

    function __ERC721MintableToken_init(
        ERC721MintableTokenInitParams calldata initParams_
    ) external override initializer {
        __ERC721_init(initParams_.tokenName, initParams_.tokenSymbol);
        __EIP712_init(initParams_.tokenName, "1");

        __Pausable_init();
        __ReentrancyGuard_init();

        _updateERC721MintableTokenParams(
            initParams_.pricePerOneToken,
            // initParams_.minNFTFloorPrice,
            initParams_.tokenName,
            initParams_.tokenSymbol
        );
    }

    function pause() external override onlyAdministrator {
        _pause();
    }

    function unpause() external override onlyAdministrator {
        _unpause();
    }

    function updateERC721MintableTokenParams(
        uint256 newPrice_,
        // uint256 newMinNFTFloorPrice_,
        string memory newTokenName_,
        string memory newTokenSymbol_
    ) external {
        _updateERC721MintableTokenParams(newPrice_, newTokenName_, newTokenSymbol_);
    }

    function setDependencies(
        address contractsRegistry,
        bytes calldata
    ) external override dependant {
        _roleManager = ContractsRegistry(contractsRegistry).getRoleManagerContract();
        _tokenFactory = ContractsRegistry(contractsRegistry).getTokenFactoryContract();
        _marketplace = ContractsRegistry(contractsRegistry).getMarketplaceContract();
    }

    function mint(address to, uint256 tokenId, string memory uri) public onlyMarketplace {
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function mintToken(
        address paymentTokenAddress_,
        uint256 paymentTokenPrice_,
        uint256 discount_,
        uint256 endTimestamp_,
        string memory tokenURI_,
        bytes32 r_,
        bytes32 s_,
        uint8 v_
    ) external payable override whenNotPaused nonReentrant {
        _verifySignature(
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
                amountToPay_ = _payWithETH(paymentTokenPrice_, discount_);
            } else {
                amountToPay_ = _payWithERC20(
                    IERC20MetadataUpgradeable(paymentTokenAddress_),
                    paymentTokenPrice_,
                    discount_
                );
            }
        }

        uint256 currentTokenId_ = _tokenId++;
        _mintToken(currentTokenId_, tokenURI_);

        emit SuccessfullyMinted(
            msg.sender,
            MintedTokenInfo(currentTokenId_, pricePerOneToken, tokenURI_),
            paymentTokenAddress_,
            amountToPay_,
            paymentTokenPrice_,
            discount_
        );
    }

    function _payWithERC20(
        IERC20MetadataUpgradeable tokenAddr_,
        uint256 tokenPrice_,
        uint256 discount_
    ) internal returns (uint256) {
        require(msg.value == 0, "ERC721MintableToken: Currency amount must be a zero.");

        // uint256 amountToPay_ = tokenPrice_ != 0
        //     ? _getAmountAfterDiscount((pricePerOneToken * DECIMAL) / tokenPrice_, discount_)
        //     : voucherTokensAmount;
        uint256 amountToPay_ = _getAmountAfterDiscount((pricePerOneToken * DECIMAL) / tokenPrice_, discount_);

        tokenAddr_.safeTransferFrom(
            msg.sender,
            address(this),
            amountToPay_.from18(tokenAddr_.decimals())
        );

        return amountToPay_;
    }

    function _payWithETH(uint256 ethPrice_, uint256 discount_) internal returns (uint256) {
        uint256 amountToPay_ = _getAmountAfterDiscount(
            (pricePerOneToken * DECIMAL) / ethPrice_,
            discount_
        );

        require(msg.value >= amountToPay_, "TokenContract: Invalid currency amount.");

        uint256 extraCurrencyAmount_ = msg.value - amountToPay_;

        if (extraCurrencyAmount_ > 0) {
            (bool success_, ) = msg.sender.call{value: extraCurrencyAmount_}("");
            require(success_, "TokenContract: Failed to return currency.");
        }

        return amountToPay_;
    }

    function _mintToken(uint256 mintTokenId_, string memory tokenURI_) internal {
        _mint(msg.sender, mintTokenId_);

        _tokenURIs[mintTokenId_] = tokenURI_;
        _existingTokenURIs[tokenURI_] = true;
    }

    function _setTokenURI(uint256 tokenId, string memory _tokenURI) internal virtual {
        require(_exists(tokenId), "ERC721MintableToken: URI set of nonexistent token");
        _tokenURIs[tokenId] = _tokenURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "ERC721MintableToken: URI query for nonexistent token");

        string memory _tokenURI = _tokenURIs[tokenId];
        string memory base = _baseURI();

        // If there is no base URI, return the token URI.
        if (bytes(base).length == 0) {
            return _tokenURI;
        }
        // If both are set, concatenate the baseURI and tokenURI (via abi.encodePacked).
        if (bytes(_tokenURI).length > 0) {
            return string(abi.encodePacked(base, _tokenURI));
        }

        return super.tokenURI(tokenId);
    }

    function _burn(uint256 tokenId) internal override {
        super._burn(tokenId);

        // TODO: check if it is needed
        if (bytes(_tokenURIs[tokenId]).length != 0) {
            delete _tokenURIs[tokenId];
        }
    }

    function _updateERC721MintableTokenParams(
        uint256 newPrice_,
        // uint256 newMinNFTFloorPrice_,
        string memory newTokenName_,
        string memory newTokenSymbol_
    ) internal {
        pricePerOneToken = newPrice_;
        // minNFTFloorPrice = newMinNFTFloorPrice_;

        _tokenName = newTokenName_;
        _tokenSymbol = newTokenSymbol_;

        emit TokenContractParamsUpdated(
            newPrice_,
            // newMinNFTFloorPrice_,
            newTokenName_,
            newTokenSymbol_
        );
    }

    function _verifySignature(
        address paymentTokenAddress_,
        uint256 paymentTokenPrice_,
        uint256 discount_,
        uint256 endTimestamp_,
        string memory tokenURI_,
        bytes32 r_,
        bytes32 s_,
        uint8 v_
    ) internal view {
        require(!_existingTokenURIs[tokenURI_], "ERC721MintableToken: Token URI already exists.");

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

        require(IRoleManager(_roleManager).isAdmin(signer_), "ERC721MintableToken: Invalid signature.");
        require(block.timestamp <= endTimestamp_, "ERC721MintableToken: Signature expired.");
    }
    

    function _onlyMarketplace() internal view {
        require(_tokenFactory == msg.sender, "ERC721MintableToken: Caller is not a Marketplace");
    }

    function _onlyAdministrator() internal view {
        require(IRoleManager(_roleManager).isAdmin(msg.sender), "ERC721MintableToken: Caller is not an Administrator");
    }

    function _getAmountAfterDiscount(uint256 amount_, uint256 discount_)
        internal
        pure
        returns (uint256)
    {
        return (amount_ * (PERCENTAGE_100 - discount_)) / PERCENTAGE_100;
    }
}
