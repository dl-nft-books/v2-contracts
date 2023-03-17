// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@dlsl/dev-modules/contracts-registry/AbstractDependant.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@dlsl/dev-modules/libs/decimals/DecimalsConverter.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@dlsl/dev-modules/utils/Globals.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "./interfaces/IRoleManager.sol";
import "./interfaces/IContractsRegistry.sol";
import "./interfaces/ITokenFactory.sol";
import "./interfaces/tokens/IERC721MintableToken.sol";

contract Marketplace is AbstractDependant, EIP712Upgradeable {    
    using EnumerableSet for EnumerableSet.AddressSet;
    using DecimalsConverter for uint256;
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;

    bytes32 internal constant _MINT_TYPEHASH =
        keccak256(
            "Mint(address paymentTokenAddress,uint256 paymentTokenPrice,uint256 discount,uint256 endTimestamp,bytes32 tokenURI)"
        );

    uint256 public pricePerOneToken;

    
    address private _roleManager;
    address private _tokenFactory;

    EnumerableSet.AddressSet internal _tokenContracts;
    mapping(address => uint256) private _pricesPerOneToken;
    mapping(address => uint256) private _currentTokenIds;

    mapping(address => string) private _tokenURIs;
    mapping(address => string) private _tokenNames;
    mapping(address => string) private _tokenSymbols;

    modifier onlyAdministrator() {
        _onlyAdministrator();
        _;
    }

    function setDependencies(
        address contractsRegistry_,
        bytes calldata
    ) external override dependant {
        _roleManager = IContractsRegistry(contractsRegistry_).getRoleManagerContract();
        _tokenFactory = IContractsRegistry(contractsRegistry_).getTokenFactoryContract();
    }

    function deployToken(
        string calldata name_,
        string calldata symbol_,
        uint256 pricePerOneToken_
        ) external onlyAdministrator {
        address tokenProxy = ITokenFactory(_tokenFactory).deployToken(name_, symbol_, pricePerOneToken_);
        _tokenContracts.add(tokenProxy);
    }

    // TODO: when not paused?; nonReentrant?
    function mintToken(
        address tokenAddress_, // added
        address paymentTokenAddress_,
        uint256 paymentTokenPrice_,
        uint256 discount_,
        uint256 endTimestamp_,
        uint256 tokenId_, // added
        string memory tokenURI_,
        bytes32 r_,
        bytes32 s_,
        uint8 v_
    ) external payable {
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


        uint256 currentTokenId_ = _currentTokenIds[tokenAddress_]++;
        IERC721MintableToken(tokenAddress_).mint(msg.sender, currentTokenId_, tokenURI_);

        // emit SuccessfullyMinted(
        //     msg.sender,
        //     MintedTokenInfo(currentTokenId_, pricePerOneToken, tokenURI_),
        //     paymentTokenAddress_,
        //     amountToPay_,
        //     paymentTokenPrice_,
        //     discount_
        // );
    }

    function updateERC721MintableTokenParams(
        address tokenAddress_, // added
        uint256 newPrice_,
        // uint256 newMinNFTFloorPrice_,
        string memory newTokenName_,
        string memory newTokenSymbol_
    ) external {
        _updateERC721MintableTokenParams(tokenAddress_, newPrice_, newTokenName_, newTokenSymbol_);
    }

    function _payWithERC20(
        IERC20MetadataUpgradeable tokenAddr_,
        uint256 tokenPrice_,
        uint256 discount_
    ) internal returns (uint256) {
        require(msg.value == 0, "Marketplace: Currency amount must be a zero.");

        // uint256 amountToPay_ = tokenPrice_ != 0
        //     ? _getAmountAfterDiscount((pricePerOneToken * DECIMAL) / tokenPrice_, discount_)
        //     : voucherTokensAmount;
        uint256 amountToPay_ = _getAmountAfterDiscount(
            (pricePerOneToken * DECIMAL) / tokenPrice_,
            discount_
        );

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

    function _updateERC721MintableTokenParams(
        address tokenAddress_,
        uint256 newPrice_,
        // uint256 newMinNFTFloorPrice_,
        string memory newTokenName_,
        string memory newTokenSymbol_
    ) internal {
        pricePerOneToken = newPrice_;
        // minNFTFloorPrice = newMinNFTFloorPrice_;

        _tokenNames[tokenAddress_] = newTokenName_;
        _tokenSymbols[tokenAddress_] = newTokenSymbol_;

        // emit TokenContractParamsUpdated(
        //     newPrice_,
        //     // newMinNFTFloorPrice_,
        //     newTokenName_,
        //     newTokenSymbol_
        // );
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
        // require(!_existingTokenURIs[tokenURI_], "Marketplace: Token URI already exists.");

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

        require(
            IRoleManager(_roleManager).isAdmin(signer_),
            "Marketplace: Invalid signature."
        );
        require(block.timestamp <= endTimestamp_, "Marketplace: Signature expired.");
    }

    function _onlyAdministrator() internal view {
        require(
            IRoleManager(_roleManager).isAdmin(msg.sender),
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
