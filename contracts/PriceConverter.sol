// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

library PriceConverter {
    function getPricee(AggregatorV3Interface priceFeeds) internal view returns (uint256) {
        (, int256 price, , ,) = priceFeeds.latestRoundData();

        return uint256(price) * 1e10;
    }

    function getUsdValue(uint256 ethAmount, AggregatorV3Interface priceFeeds) internal view returns (uint256) {
        uint256 price = getPricee(priceFeeds);   // 1 eth -> USD

        return (price * ethAmount) / 1e18;
    }
}