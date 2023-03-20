const { assert } = require("chai");
const { toBN, accounts } = require("../scripts/utils/utils");
const Reverter = require("./helpers/reverter");
const truffleAssert = require("truffle-assertions");

const ContractsRegistry = artifacts.require("ContractsRegistry");
const ERC20MockUpgradeable = artifacts.require("ERC20MockUpgradeable");
const ERC20MockUpgradeableUpgraded = artifacts.require("ERC20MockUpgradeableUpgraded");

ContractsRegistry.numberFormat = "BigNumber";
ERC20MockUpgradeable.numberFormat = "BigNumber";

describe("ContractsRegistry", () => {
  let OWNER;

  let contractsRegistry;

  const reverter = new Reverter();

  before("setup", async () => {
    OWNER = await accounts(0);

    contractsRegistry = await ContractsRegistry.new();

    await contractsRegistry.__OwnableContractsRegistry_init();

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("contract management", () => {
    it("should add and remove the contract", async () => {
      const Marketplace = await ERC20MockUpgradeable.new("Marketplace", "MTP", 18);

      await contractsRegistry.addContract(await contractsRegistry.MARKETPLACE_NAME(), Marketplace.address);

      assert.equal(await contractsRegistry.getMarketplaceContract(), Marketplace.address);
      assert.isTrue(await contractsRegistry.hasContract(await contractsRegistry.MARKETPLACE_NAME()));

      await contractsRegistry.removeContract(await contractsRegistry.MARKETPLACE_NAME());

      await truffleAssert.reverts(
        contractsRegistry.getMarketplaceContract(),
        "ContractsRegistry: this mapping doesn't exist"
      );
      assert.isFalse(await contractsRegistry.hasContract(await contractsRegistry.MARKETPLACE_NAME()));
    });

    it("should add and remove the proxy contract", async () => {
      const Marketplace = await ERC20MockUpgradeable.new("Marketplace", "MTP", 18);

      await contractsRegistry.addProxyContract(await contractsRegistry.MARKETPLACE_NAME(), Marketplace.address);

      assert.isTrue(await contractsRegistry.hasContract(await contractsRegistry.MARKETPLACE_NAME()));

      await contractsRegistry.removeContract(await contractsRegistry.MARKETPLACE_NAME());

      assert.isFalse(await contractsRegistry.hasContract(await contractsRegistry.MARKETPLACE_NAME()));
    });

    it("should just add and remove the proxy contract", async () => {
      const _Marketplace = await ERC20MockUpgradeable.new("Marketplace", "MTP", 18);

      await contractsRegistry.addProxyContract(await contractsRegistry.MARKETPLACE_NAME(), _Marketplace.address);

      const Marketplace = await contractsRegistry.getMarketplaceContract();

      await contractsRegistry.removeContract(await contractsRegistry.MARKETPLACE_NAME());

      await contractsRegistry.justAddProxyContract(await contractsRegistry.MARKETPLACE_NAME(), _Marketplace.address);

      assert.isTrue(await contractsRegistry.hasContract(await contractsRegistry.MARKETPLACE_NAME()));

      await contractsRegistry.removeContract(await contractsRegistry.MARKETPLACE_NAME());

      assert.isFalse(await contractsRegistry.hasContract(await contractsRegistry.MARKETPLACE_NAME()));
    });
  });

  describe("contract upgrades", () => {
    let _Marketplace;
    let _Marketplace2;

    let Marketplace;

    beforeEach("setup", async () => {
      _Marketplace = await ERC20MockUpgradeable.new("USD", "USD", 18);
      _Marketplace2 = await ERC20MockUpgradeableUpgraded.new("USD", "USD", 18);

      await contractsRegistry.addProxyContract(await contractsRegistry.MARKETPLACE_NAME(), _Marketplace.address);

      Marketplace = await ERC20MockUpgradeableUpgraded.at(await contractsRegistry.getMarketplaceContract());
    });

    it("should upgrade the contract", async () => {
      await truffleAssert.reverts(Marketplace.addedFunction());

      assert.equal(
        await contractsRegistry.getImplementation(await contractsRegistry.MARKETPLACE_NAME()),
        _Marketplace.address
      );

      await contractsRegistry.upgradeContract(await contractsRegistry.MARKETPLACE_NAME(), _Marketplace2.address);

      assert.equal(toBN(await Marketplace.addedFunction()).toFixed(), "42");
    });

    it("should upgrade and call the contract", async () => {
      await truffleAssert.reverts(Marketplace.addedFunction());

      let data = web3.eth.abi.encodeFunctionCall(
        {
          name: "doUpgrade",
          inputs: [
            {
              type: "uint256",
              name: "value",
            },
          ],
        },
        ["42"]
      );

      await contractsRegistry.upgradeContractAndCall(
        await contractsRegistry.MARKETPLACE_NAME(),
        _Marketplace2.address,
        data
      );

      assert.equal(toBN(await Marketplace.importantVariable()).toFixed(), "42");
    });
  });
});
