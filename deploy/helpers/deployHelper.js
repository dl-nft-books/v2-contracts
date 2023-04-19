const fs = require("fs");

const { web3 } = require("hardhat");

function nonEmptyField(field, fieldName, onlyUndefined = false) {
  if (field != undefined && (onlyUndefined || (field !== "" && field.length !== 0))) {
    return field;
  }

  throw new Error(`Empty ${fieldName} field.`);
}

function parseConfig(path = "deploy/data/config.json") {
  const configJson = JSON.parse(fs.readFileSync(path, "utf8"));

  nonEmptyField(configJson.baseTokenContractsURI, "baseTokenContractsURI", true);
  nonEmptyField(configJson.roles, "roles", true);

  const allRoles = [];
  const rolesMembers = [];
  const roleInitParams = [
    {
      role: "0x0000000000000000000000000000000000000000000000000000000000000000",
      roleAdmin: "0x0000000000000000000000000000000000000000000000000000000000000000",
      roleName: "Default admin",
    },
  ];

  configJson.roles.forEach((roleInfo) => {
    const role = web3.utils.keccak256(nonEmptyField(roleInfo.roleKey, "role key"));
    const roleAdmin = web3.utils.keccak256(nonEmptyField(roleInfo.roleAdminKey, "role admin key"));
    const roleName = nonEmptyField(roleInfo.roleName, "role name");
    const members = nonEmptyField(roleInfo.members, "role members", true);

    allRoles.push(role);
    rolesMembers.push(members);
    roleInitParams.push({
      role,
      roleAdmin,
      roleName,
    });
  });

  return {
    baseTokenContractsURI: configJson.baseTokenContractsURI,
    allRoles,
    rolesMembers,
    roleInitParams,
  };
}

module.exports = {
  parseConfig,
};
