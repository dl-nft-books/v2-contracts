const ContractsRegistry = artifacts.require("ContractsRegistry");
const Marketplace = artifacts.require("Marketplace");
const Proxy = artifacts.require("TransparentUpgradeableProxy");

module.exports = async (deployer, logger) => {
  const contractsRegistry = await ContractsRegistry.at((await Proxy.deployed()).address);
  
  const marketplace = await deployer.deploy(Marketplace);

  logger.logTransaction(
    await contractsRegistry.addProxyContract(await contractsRegistry.MARKETPLACE_NAME(), marketplace.address),
    "Add marketplace"
  );
};
