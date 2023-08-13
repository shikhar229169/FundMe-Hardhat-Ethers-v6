const { ethers, network, deployments, getNamedAccounts } = require("hardhat")
const { networkConfig, localNetwork } = require("../helper-hardhat-config.js")
const { assert, expect } = require("chai")

const fundWithMultipleUser = async(fundMe, fundAmt) => {
  const accounts = await ethers.getSigners()

  for (let i = 1; i <= 10; i++) {
    const response = await (fundMe.connect(accounts[i])).fund({value: fundAmt})
    await response.wait(1)
  }

  return (await ethers.provider.getBalance(fundMe.target))
}

!localNetwork.includes(network.name)
  ? describe.skip :
  describe("FundMe Testing", () => {
    let fundMe
    let priceFeeds
    let deployer
    let chainId = network.config.chainId
    let fundAmt = networkConfig[chainId].minFundAmt
    let billi
    let attacker
    let accounts

    beforeEach(async() => {
      accounts = await ethers.getSigners()
      billi = accounts[1]
      attacker = accounts[2]
      
      deployer = (await getNamedAccounts()).deployer
      const contracts = await deployments.fixture(["main", "mocks"])
      
      priceFeeds = contracts["MockV3Aggregator"]
      const _fundMe = contracts["FundMe"]
      fundMe = await ethers.getContractAt("FundMe", _fundMe.address)
    })

    describe("Constructor Testing", () => {
      it("All variables set up correctly", async() => {
        const actualOwner = await fundMe.getOwner()
        const actualFundAmt = await fundMe.getMinUsdFundAmount()
        const actualPriceFeeds = await fundMe.getPriceFeedsAddress()

        console.table([actualOwner, actualFundAmt, actualPriceFeeds])

        assert.equal(actualOwner, deployer)
        assert.equal(actualFundAmt, fundAmt)
        assert.equal(actualPriceFeeds, priceFeeds.address)
      })
    })

    describe("Price Converter Testing", () => {
      it("Gives Correct Value", async() => {
        const currEth = ethers.parseEther("10")

        const expectedValue = BigInt("18516200000000000000000")
        const usdValue = await fundMe.getUsdValue(currEth)
        assert.equal(usdValue, expectedValue)
      })
    })

    describe("Fund Function Testing", () => {
      it("Reverts if fund amount less than min", async() => {
        await expect(fundMe.fund()).to.be.revertedWithCustomError(fundMe, "FundMe__lessAmountSent")
      })

      it("Allows others to fund and updates data", async() => {
        const initContractBalance = await ethers.provider.getBalance(fundMe.target)
        const initUserBalance = await ethers.provider.getBalance(billi.address)

        const fundTxn = await (fundMe.connect(billi)).fund({value: fundAmt})
        const response = await fundTxn.wait(1)
        const { gasUsed, gasPrice } = response

        const funder = await fundMe.getFunder(0)
        const actualFundAmt = await fundMe.getFundingBy(billi.address)
        
        const finalContractBalance = await ethers.provider.getBalance(fundMe.target)
        const finalUserBalance = await ethers.provider.getBalance(billi.address) 

        assert.equal(funder, billi.address)
        assert.equal(finalContractBalance, initContractBalance + fundAmt)
        assert.equal(finalUserBalance, initUserBalance - fundAmt - (gasUsed * gasPrice))
        assert.equal(actualFundAmt, fundAmt)
      })

      it("Emits the event", async() => {
        const minFundAmt = "27003380823300000"
        const fundTxn = await expect((fundMe.connect(billi)).fund({value: minFundAmt})).to.emit(fundMe, "Funded").withArgs(billi.address, minFundAmt)
      })
    })

    describe("Withdraw function Testing", () => {
      it("Reverts if amount is zero", async() => {
        await expect(fundMe.withdraw()).to.revertedWithCustomError(fundMe, "FundMe__cantWithdrawZeroAmount")
      })

      it("Allows owner to withdraw", async() => {
        const fundMeBalance = await fundWithMultipleUser(fundMe, fundAmt)
        const actualBalance = fundAmt * BigInt(10);
        assert.equal(fundMeBalance, actualBalance)

        const funders = await fundMe.getAllFunders()
        for (let i = 1; i <= 10; i++) {
          assert.equal(funders[i-1], accounts[i].address)
        }

        const initOwnerBalance = await ethers.provider.getBalance(deployer)

        const res = await fundMe.withdraw()
        const { gasUsed, gasPrice } = await res.wait(1)

        const finalFundMeBalance = await ethers.provider.getBalance(fundMe.target)
        const ownerBalance = await ethers.provider.getBalance(deployer)
        assert.equal(ownerBalance, initOwnerBalance + fundMeBalance - (gasUsed * gasPrice))
        assert.equal(finalFundMeBalance, 0)
        await expect(fundMe.getFunder(0)).to.be.reverted
      })
      
      it("Reverts if caller is not owner", async() => {
        await fundWithMultipleUser(fundMe, fundAmt)

        await expect(fundMe.connect(attacker).withdraw()).revertedWithCustomError(fundMe, "FundMe__notOwner")
      })
    })
  })