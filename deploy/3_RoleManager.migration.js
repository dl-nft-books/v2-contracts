const Proxy = artifacts.require("PublicERC1967Proxy");
const ContractsRegistry = artifacts.require("ContractsRegistry");
const RoleManager = artifacts.require("RoleManager");

module.exports = async (deployer, logger) => {
  const contractsRegistry = await ContractsRegistry.at((await Proxy.deployed()).address);
  
  const roleManager = await deployer.deploy(RoleManager);

  logger.logTransaction(
    await contractsRegistry.addProxyContract(await contractsRegistry.ROLE_MANAGER_NAME(), roleManager.address),
    "Add roleManager"
  );
};
