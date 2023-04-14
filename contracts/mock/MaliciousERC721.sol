// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.18;

import "../interfaces/IMarketplace.sol";

contract MaliciousERC721 {
    struct MintNFTParams {
        address contractAddress;
        uint256 nextTokenId;
        uint256 nftFloorPrice;
        uint256 tokenId;
        uint256 endTimestamp;
        string tokenURI;
        bytes32 r;
        bytes32 s;
        uint8 v;
    }

    IMarketplace public marketplace;
    MintNFTParams public params;
    uint256 public counter;

    constructor(address marketplace_) {
        marketplace = IMarketplace(marketplace_);

        counter = 2;
    }

    function setParams(MintNFTParams memory params_) external {
        params = params_;
    }

    // function safeTransferFrom(address, address, uint256) external {
    //     for (uint256 i = 0; i < counter; i++) {
    //         marketplace.buyTokenByNFT(
    //             params.contractAddress,
    //             params.nextTokenId + 1 + i,
    //             address(this),
    //             params.nftFloorPrice,
    //             params.tokenId,
    //             params.endTimestamp,
    //             params.tokenURI,
    //             params.r,
    //             params.s,
    //             params.v
    //         );
    //     }
    // }

    // function mintToken() external {
    //     marketplace.buyTokenByNFT(
    //         params.contractAddress,
    //         params.nextTokenId,
    //         address(this),
    //         params.nftFloorPrice,
    //         params.tokenId,
    //         params.endTimestamp,
    //         params.tokenURI,
    //         params.r,
    //         params.s,
    //         params.v
    //     );
    // }

    function ownerOf(uint256) external view returns (address) {
        return address(this);
    }
}
