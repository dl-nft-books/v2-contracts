const ContractsRegistry = artifacts.require("ContractsRegistry");
const PublicERC1967Proxy = artifacts.require("PublicERC1967Proxy");

module.exports = async (deployer, logger) => {
  const contractsRegistry = await deployer.deploy(ContractsRegistry);
  const proxy = await deployer.deploy(PublicERC1967Proxy, contractsRegistry.address, "0x");
  const contractsRegistryProxy = await ContractsRegistry.at(proxy.address);

  await ContractsRegistry.setAsDeployed(contractsRegistryProxy);

  logger.logTransaction(await contractsRegistryProxy.__OwnableContractsRegistry_init(), "Init ContractsRegistry");
};
