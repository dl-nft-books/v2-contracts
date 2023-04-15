const ContractsRegistry = artifacts.require("ContractsRegistry");
const RoleManager = artifacts.require("RoleManager");

const { parseConfig } = require("./helpers/deployHelper");

module.exports = async (deployer, logger) => {
  const config = parseConfig();

  const contractsRegistry = await ContractsRegistry.deployed();

  const roleManager = await RoleManager.at(await contractsRegistry.getRoleManagerContract());

  logger.logTransaction(
    await roleManager.grantRoleBatch(config.allRoles, config.rolesMembers),
    "Add initial role members"
  );
};
