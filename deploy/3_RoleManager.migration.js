const ContractsRegistry = artifacts.require("ContractsRegistry");
const RoleManager = artifacts.require("RoleManager");
const Proxy = artifacts.require("TransparentUpgradeableProxy");

module.exports = async (deployer, logger) => {
  const contractsRegistry = await ContractsRegistry.at((await Proxy.deployed()).address);
  
  const roleManager = await deployer.deploy(RoleManager);

  logger.logTransaction(
    await contractsRegistry.addProxyContract(await contractsRegistry.ROLE_MANAGER_NAME(), roleManager.address),
    "Add roleManager"
  );
};
