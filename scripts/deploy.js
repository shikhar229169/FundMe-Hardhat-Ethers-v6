const { ethers, network } = require("hardhat")
const { networkConfig, localNetwork } = require("../helper-hardhat-config.js")
const { verifyContract } = require("../utils/VerifyContract.js")
require("dotenv").config()

async function main() {
    const chainId = network.config.chainId

    let priceFeedsAddr
    const minFundAmt = networkConfig[chainId].minFundAmt
    
    // Price Feeds Aggregator
    if (localNetwork.includes(network.name)) {
        const pfTxn = await ethers.getContractFactory("MockV3Aggregator")
        const pf = await pfTxn.deploy(...[8, 180000000000])
        priceFeedsAddr = pf.address
    }
    else {
        priceFeedsAddr = networkConfig[chainId].priceFeeds
    }
    console.log(`Price Feeds Contract: ${priceFeedsAddr}`)


    const args = [priceFeedsAddr, minFundAmt]

    console.log("Deploying FundMe ...........")
    
    const fundMeFactory = await ethers.getContractFactory("FundMe")
    const fundMeTxn = await fundMeFactory.deploy(...args)

    const fundMe = await fundMeTxn.deploymentTransaction().wait(2)

    console.log(`FundMe Contract: ${fundMe.contractAddress}`)

    const funnnd = await ethers.getContractAt("FundMe", fundMe.contractAddress)
    console.log(await funnnd.getPriceFeedsAddress())
    console.log((await funnnd.getUsdValue("4000000000000000000")).toString())

    if (!localNetwork.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        await verifyContract(fundMe.contractAddress, args)
    }
}


main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
