const Proxy = artifacts.require("PublicERC1967Proxy");
const ContractsRegistry = artifacts.require("ContractsRegistry");

const RoleManager = artifacts.require("RoleManager");

const { parseRolesParams } = require("./helpers/deployHelper");

module.exports = async (deployer, logger) => {
  const RolesParams = parseRolesParams("./deploy/data/rolesParams.json");

  const contractsRegistry = await ContractsRegistry.at((await Proxy.deployed()).address);

  const roleManager = await RoleManager.at(await contractsRegistry.getRoleManagerContract());

  logger.logTransaction(
    await roleManager.grantRoleBatch(RolesParams.roles, RolesParams.users),
    "Add initial role members"
  );
};
