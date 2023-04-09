// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "../interfaces/IMarketplace.sol";

contract Attacker {
    struct MintParams {
        address contractAddress;
        uint256 tokenId;
        uint256 expectedCost;
        address paymentTokenAddress;
        uint256 paymentTokenPrice;
        uint256 discount;
        uint256 endTimestamp;
        string tokenURI;
        bytes32 r;
        bytes32 s;
        uint8 v;
    }

    IMarketplace public marketplace;
    MintParams public params;
    uint256 public counter;

    constructor(address marketplace_, MintParams memory params_) {
        marketplace = IMarketplace(marketplace_);

        params = params_;
    }

    // receive() external payable {
    //     if (counter < 1) {
    //         counter++;

    //         marketplace.buyToken{value: params.expectedCost}(
    //             params.contractAddress,
    //             params.tokenId + 1,
    //             params.paymentTokenAddress,
    //             params.paymentTokenPrice,
    //             params.discount,
    //             params.endTimestamp,
    //             params.tokenURI,
    //             params.r,
    //             params.s,
    //             params.v
    //         );
    //     }
    // }

    // function buyToken() external payable {
    //     marketplace.buyToken{value: msg.value}(
    //         params.contractAddress,
    //         params.tokenId,
    //         params.paymentTokenAddress,
    //         params.paymentTokenPrice,
    //         params.discount,
    //         params.endTimestamp,
    //         params.tokenURI,
    //         params.r,
    //         params.s,
    //         params.v
    //     );
    // }
}
