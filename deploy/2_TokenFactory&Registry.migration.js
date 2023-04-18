const ContractsRegistry = artifacts.require("ContractsRegistry");
const TokenFactory = artifacts.require("TokenFactory");
const TokenRegistry = artifacts.require("TokenRegistry");

module.exports = async (deployer, logger) => {
  const contractsRegistry = await ContractsRegistry.deployed();

  const tokenFactory = await deployer.deploy(TokenFactory);
  const tokenRegistry = await deployer.deploy(TokenRegistry);

  logger.logTransaction(
    await contractsRegistry.addProxyContract(await contractsRegistry.TOKEN_FACTORY_NAME(), tokenFactory.address),
    "AddProxy TokenFactory"
  );
  logger.logTransaction(
    await contractsRegistry.addProxyContract(await contractsRegistry.TOKEN_REGISTRY_NAME(), tokenRegistry.address),
    "AddProxy TokenRegistry"
  );
};
