const fs = require("fs");
const { keccak256 } = require("@ethersproject/keccak256");
const { toUtf8Bytes } = require("@ethersproject/strings");

const { ZERO_ADDR } = require("../../scripts/utils/constants");

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

function validAddressesArr(arr, arrName, onlyUndefined = false) {
  nonEmptyField(arr, arrName, onlyUndefined);

  for (let i = 0; i < arr.length; i++) {
    nonEmptyAddress(arr[i], arrName, onlyUndefined);
  }

  return arr;
}

function validOrEmptyAddressesArr(arr, arrName, onlyUndefined = false) {
  console.log(arr)
  console.log(arrName)
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

  for(let i = 0; i < rolesParams.ADMINISTRATOR_ROLE.length; i++) {
    roles.push(keccak256(toUtf8Bytes("ADMINISTRATOR_ROLE")));
    users.push(rolesParams.ADMINISTRATOR_ROLE[i]);
  }
  console.log("!!!!!");
  for(let i = 0; i < rolesParams.TOKEN_FACTORY_MANAGER.length; i++) {
    roles.push(keccak256(toUtf8Bytes("TOKEN_FACTORY_MANAGER")));
    users.push(rolesParams.TOKEN_FACTORY_MANAGER[i]);
  }
  for(let i = 0; i < rolesParams.TOKEN_REGISTRY_MANAGER.length; i++) {
    roles.push(keccak256(toUtf8Bytes("TOKEN_REGISTRY_MANAGER")));
    users.push(rolesParams.TOKEN_REGISTRY_MANAGER[i]);
  }
  for(let i = 0; i < rolesParams.TOKEN_MANAGER.length; i++) {
    roles.push(keccak256(toUtf8Bytes("TOKEN_MANAGER")));
    users.push(rolesParams.TOKEN_MANAGER[i]);
  }
  for(let i = 0; i < rolesParams.ROLE_SUPERVISOR.length; i++) {
    roles.push(keccak256(toUtf8Bytes("ROLE_SUPERVISOR")));
    users.push(rolesParams.ROLE_SUPERVISOR[i]);
  }
  for(let i = 0; i < rolesParams.WITHDRAWAL_MANAGER.length; i++) {
    roles.push(keccak256(toUtf8Bytes("WITHDRAWAL_MANAGER")));
    users.push(rolesParams.WITHDRAWAL_MANAGER[i]);
  }
  for(let i = 0; i < rolesParams.MARKETPLACE_MANAGER.length; i++) {
    roles.push(keccak256(toUtf8Bytes("MARKETPLACE_MANAGER")));
    users.push(rolesParams.MARKETPLACE_MANAGER[i]);
  }

  return {
    roles: roles,
    users: users
  };
}

module.exports = {
  nonEmptyField,
  validAddressesArr,
  parseMarketplaceParams,
  parseRolesParams,
};
