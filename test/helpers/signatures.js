const { fromRpcSig } = require("ethereumjs-util");
const { signTypedData } = require("@metamask/eth-sig-util");

const signBuy = (domain, message, privateKey) => {
  const { name, version = "1", chainId = 1, verifyingContract } = domain;

  const EIP712Domain = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ];

  const Buy = [
    { name: "tokenContract", type: "address" },
    { name: "futureTokenId", type: "uint256" },
    { name: "paymentTokenAddress", type: "address" },
    { name: "paymentTokenPrice", type: "uint256" },
    { name: "discount", type: "uint256" },
    { name: "endTimestamp", type: "uint256" },
    { name: "tokenURI", type: "bytes32" },
  ];

  const data = {
    primaryType: "Buy",
    types: { EIP712Domain, Buy },
    domain: { name, version, chainId, verifyingContract },
    message: message,
  };

  return fromRpcSig(signTypedData({ privateKey, data, version: "V4" }));
};

const signBuyWithRequest = (domain, message, privateKey) => {
  const { name, version = "1", chainId = 1, verifyingContract } = domain;

  const EIP712Domain = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ];

  const BuyWithRequest = [
    { name: "requestId", type: "uint256" },
    { name: "futureTokenId", type: "uint256" },
    { name: "endTimestamp", type: "uint256" },
    { name: "tokenURI", type: "bytes32" },
  ];

  const data = {
    primaryType: "BuyWithRequest",
    types: { EIP712Domain, BuyWithRequest },
    domain: { name, version, chainId, verifyingContract },
    message: message,
  };

  return fromRpcSig(signTypedData({ privateKey, data, version: "V4" }));
};

const signPermit = (domain, message, privateKey) => {
  const { name, version = "1", chainId = 1, verifyingContract } = domain;

  const EIP712Domain = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ];

  const Permit = [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ];

  const data = {
    primaryType: "Permit",
    types: { EIP712Domain, Permit },
    domain: { name, version, chainId, verifyingContract },
    message: message,
  };

  return fromRpcSig(signTypedData({ privateKey, data, version: "V4" }));
};

module.exports = {
  signBuy,
  signPermit,
  signBuyWithRequest,
};
