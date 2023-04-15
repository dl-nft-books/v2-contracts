const fs = require("fs");
const { toUtf8Bytes } = require("@ethersproject/strings");

const { ZERO_ADDR } = require("../../scripts/utils/constants");
const { web3 } = require("hardhat");

function nonEmptyField(field, fieldName, onlyUndefined = false) {
  if (field != undefined && (onlyUndefined || (field !== "" && field.length !== 0))) {
    return field;
  }

  throw new Error(`Empty ${fieldName} field.`);
}

function nonEmptyAddress(addr, arrName, onlyUndefined = false) {
  nonEmptyField(addr, arrName, onlyUndefined);

  if (addr !== ZERO_ADDR) {
    return addr;
  }

  throw new Error(`Zero address in ${arrName} array.`);
}

function validOrEmptyAddressesArr(arr, arrName, onlyUndefined = false) {
  console.log(arr);
  console.log(arrName);
  for (let i = 0; i < arr.length; i++) {
    nonEmptyAddress(arr[i], arrName, onlyUndefined);
  }

  return arr;
}

function parseMarketplaceParams(path) {
  const marketplaceParams = JSON.parse(fs.readFileSync(path, "utf8"));

  nonEmptyField(marketplaceParams.baseTokenContractsURI, "baseTokenContractsURI", true);

  return {
    baseTokenContractsURI: marketplaceParams.baseTokenContractsURI,
  };
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

function verifyRoleInfo(roleInfo) {
  if (!roleInfo.roleKey) {
    throw new Error(`Invalid role key`);
  }

  if (!roleInfo.roleAdminKey) {
    throw new Error(`Invalid role admin key`);
  }

  if (!roleInfo.roleName) {
    throw new Error(`Empty role name`);
  }
}

function parseRoleInitParams(path = "deploy/data/roleInitParams.json") {
  const roleInitParams = JSON.parse(fs.readFileSync(path, "utf8"));

  const resultArr = [];

  resultArr.push({
    role: "0x0000000000000000000000000000000000000000000000000000000000000000",
    roleAdmin: "0x0000000000000000000000000000000000000000000000000000000000000000",
    roleName: "Default admin",
  });

  roleInitParams.forEach((initParams, index) => {
    if (!initParams?.roleKey) {
      throw new Error(`Invalid role key in struct by ${index} index`);
    }

    if (!initParams?.roleAdminKey) {
      throw new Error(`Invalid role admin key in struct by ${index} index`);
    }

    if (!initParams?.roleName) {
      throw new Error(`Empty role name in struct by ${index} index`);
    }

    const role = web3.utils.keccak256(initParams.roleKey);
    const roleAdmin = web3.utils.keccak256(initParams.roleAdminKey);

    resultArr.push({
      role,
      roleAdmin,
      roleName: initParams.roleName,
    });
  });

  return resultArr;
}

function parseRolesParams(path) {
  const rolesParams = JSON.parse(fs.readFileSync(path, "utf8"));

  validOrEmptyAddressesArr(rolesParams.ADMINISTRATOR_ROLE, "ADMINISTRATOR_ROLE");
  validOrEmptyAddressesArr(rolesParams.TOKEN_FACTORY_MANAGER, "TOKEN_FACTORY_MANAGER");
  validOrEmptyAddressesArr(rolesParams.TOKEN_REGISTRY_MANAGER, "TOKEN_REGISTRY_MANAGER");
  validOrEmptyAddressesArr(rolesParams.TOKEN_MANAGER, "TOKEN_MANAGER");
  validOrEmptyAddressesArr(rolesParams.ROLE_SUPERVISOR, "ROLE_SUPERVISOR");
  validOrEmptyAddressesArr(rolesParams.WITHDRAWAL_MANAGER, "WITHDRAWAL_MANAGER");
  validOrEmptyAddressesArr(rolesParams.MARKETPLACE_MANAGER, "MARKETPLACE_MANAGER");

  const roles = [];
  const users = [];

  for (let i = 0; i < rolesParams.ADMINISTRATOR_ROLE.length; i++) {
    roles.push(keccak256(toUtf8Bytes("ADMINISTRATOR_ROLE")));
    users.push(rolesParams.ADMINISTRATOR_ROLE[i]);
  }
  console.log("!!!!!");
  for (let i = 0; i < rolesParams.TOKEN_FACTORY_MANAGER.length; i++) {
    roles.push(keccak256(toUtf8Bytes("TOKEN_FACTORY_MANAGER")));
    users.push(rolesParams.TOKEN_FACTORY_MANAGER[i]);
  }
  for (let i = 0; i < rolesParams.TOKEN_REGISTRY_MANAGER.length; i++) {
    roles.push(keccak256(toUtf8Bytes("TOKEN_REGISTRY_MANAGER")));
    users.push(rolesParams.TOKEN_REGISTRY_MANAGER[i]);
  }
  for (let i = 0; i < rolesParams.TOKEN_MANAGER.length; i++) {
    roles.push(keccak256(toUtf8Bytes("TOKEN_MANAGER")));
    users.push(rolesParams.TOKEN_MANAGER[i]);
  }
  for (let i = 0; i < rolesParams.ROLE_SUPERVISOR.length; i++) {
    roles.push(keccak256(toUtf8Bytes("ROLE_SUPERVISOR")));
    users.push(rolesParams.ROLE_SUPERVISOR[i]);
  }
  for (let i = 0; i < rolesParams.WITHDRAWAL_MANAGER.length; i++) {
    roles.push(keccak256(toUtf8Bytes("WITHDRAWAL_MANAGER")));
    users.push(rolesParams.WITHDRAWAL_MANAGER[i]);
  }
  for (let i = 0; i < rolesParams.MARKETPLACE_MANAGER.length; i++) {
    roles.push(keccak256(toUtf8Bytes("MARKETPLACE_MANAGER")));
    users.push(rolesParams.MARKETPLACE_MANAGER[i]);
  }

  return {
    roles: roles,
    users: users,
  };
}

module.exports = {
  parseConfig,
  parseMarketplaceParams,
  parseRoleInitParams,
  parseRolesParams,
};
