const Proxy = artifacts.require("PublicERC1967Proxy");
const ContractsRegistry = artifacts.require("ContractsRegistry");

const TokenFactory = artifacts.require("TokenFactory");
const TokenRegistry = artifacts.require("TokenRegistry");
const RoleManager = artifacts.require("RoleManager");
const Marketplace = artifacts.require("Marketplace");

const { parseMarketplaceParams } = require("./helpers/deployHelper");

module.exports = async (deployer, logger) => {
  const MarketplaceParams = parseMarketplaceParams("./deploy/data/marketplaceParams.json");

  const contractsRegistry = await ContractsRegistry.at((await Proxy.deployed()).address);

  const tokenFactory = await TokenFactory.at(await contractsRegistry.getTokenFactoryContract());
  const tokenRegistry = await TokenRegistry.at(await contractsRegistry.getTokenRegistryContract());

  const roleManager = await RoleManager.at(await contractsRegistry.getRoleManagerContract());

  const marketplace = await Marketplace.at(await contractsRegistry.getMarketplaceContract());

  ////////////////////////////////////////////////////////////

  console.log();

  logger.logTransaction(await roleManager.__RoleManager_init(), "Init RoleManager");

  logger.logTransaction(
    await marketplace.__Marketplace_init(MarketplaceParams.baseTokenContractsURI),
    "Init Marketplace"
  );

  ////////////////////////////////////////////////////////////

  console.log();

  logger.logTransaction(
    await contractsRegistry.injectDependencies(await contractsRegistry.ROLE_MANAGER_NAME()),
    "Inject RoleManager"
  );

  logger.logTransaction(
    await contractsRegistry.injectDependencies(await contractsRegistry.MARKETPLACE_NAME()),
    "Inject Marketplace"
  );

  logger.logTransaction(
    await contractsRegistry.injectDependencies(await contractsRegistry.TOKEN_REGISTRY_NAME()),
    "Inject TokenRegistry"
  );

  logger.logTransaction(
    await contractsRegistry.injectDependencies(await contractsRegistry.TOKEN_FACTORY_NAME()),
    "Inject TokenFactory"
  );

  ////////////////////////////////////////////////////////////

  logger.logContracts(
    ["ContractsRegistry", contractsRegistry.address],
    ["RoleManager", roleManager.address],
    ["Marketplace", marketplace.address],
    ["TokenFactory", tokenFactory.address],
    ["TokenRegistry", tokenRegistry.address]
  );
};
