const ContractsRegistry = artifacts.require("ContractsRegistry");
const TransparentUpgradeableProxy = artifacts.require("TransparentUpgradeableProxy");

module.exports = async (deployer, logger) => {
  const contractsRegistry = await deployer.deploy(ContractsRegistry);
  const proxy = await deployer.deploy(TransparentUpgradeableProxy, contractsRegistry.address, contractsRegistry.address, []);
  
  logger.logTransaction(
    await (await ContractsRegistry.at(proxy.address)).__OwnableContractsRegistry_init(),
    "Init ContractsRegistry"
  );
};
