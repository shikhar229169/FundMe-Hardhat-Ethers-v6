// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {PriceConverter} from "./PriceConverter.sol";

contract FundMe {
    using PriceConverter for uint256;

    error FundMe__lessAmountSent();
    error FundMe__notOwner();
    error FundMe__cantWithdrawZeroAmount();
    error FundMe__withdrawalFailed();

    address private immutable i_owner;
    address[] private funders;
    mapping(address funder => uint256 amountFunded) private funding;
    AggregatorV3Interface private immutable i_priceFeeds;
    uint256 private immutable i_minUsdAmt;

    event Funded(address indexed funder, uint256 indexed amount);
    event Withdrawn(uint256 indexed amount);

    modifier onlyOwner() {
        if (msg.sender != i_owner) {
            revert FundMe__notOwner();
        }
        _;
    }

    constructor(address priceFeeds, uint256 minUsdAmount) {
        i_owner = msg.sender;
        i_priceFeeds = AggregatorV3Interface(priceFeeds);
        i_minUsdAmt = minUsdAmount;
    }

    function fund() external payable {
        if (msg.value.getUsdValue(i_priceFeeds) < i_minUsdAmt) {
            revert FundMe__lessAmountSent();
        }

        if (funding[msg.sender] == 0) {
            funders.push(msg.sender);
        }

        funding[msg.sender] += msg.value;

        emit Funded(msg.sender, msg.value);
    }

    function withdraw() external onlyOwner {
        if (address(this).balance == 0) {
            revert FundMe__cantWithdrawZeroAmount();
        }

        address[] memory _funders = funders;
        uint256 len = _funders.length;

        for (uint256 i = 0; i < len; ++i) {
            funding[_funders[i]] = 0;
        }

        funders = new address[](0);

        emit Withdrawn(address(this).balance);

        (bool successs, ) = payable(i_owner).call{value: address(this).balance}("");

        if (!successs) {
            revert FundMe__withdrawalFailed();
        }
    }

    function getUsdValue(uint256 amount) external view returns (uint256 usdValue) {
        usdValue = amount.getUsdValue(i_priceFeeds);
    }

    function getOwner() external view returns (address) {
        return i_owner;
    }

    function getFunder(uint256 idx) external view returns (address) {
        return funders[idx];
    }

    function getAllFunders() external view returns (address[] memory) {
        return funders;
    }

    function getFundingBy(address funder) external view returns (uint256) {
        return funding[funder];
    }

    function getMinUsdFundAmount() external view returns (uint256) {
        return i_minUsdAmt;
    }

    function getPriceFeedsAddress() external view returns (address) {
        return address(i_priceFeeds);
    }
}