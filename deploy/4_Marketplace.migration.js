const ContractsRegistry = artifacts.require("ContractsRegistry");
const Marketplace = artifacts.require("Marketplace");

module.exports = async (deployer, logger) => {
  const contractsRegistry = await ContractsRegistry.deployed();

  const marketplace = await deployer.deploy(Marketplace);

  logger.logTransaction(
    await contractsRegistry.addProxyContract(await contractsRegistry.MARKETPLACE_NAME(), marketplace.address),
    "Add marketplace"
  );
};
