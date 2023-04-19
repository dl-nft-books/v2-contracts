const ContractsRegistry = artifacts.require("ContractsRegistry");
const TokenRegistry = artifacts.require("TokenRegistry");
const ERC721MintableToken = artifacts.require("ERC721MintableToken");

module.exports = async (deployer, logger) => {
  const contractsRegistry = await ContractsRegistry.deployed();

  const tokenRegistry = await TokenRegistry.at(await contractsRegistry.getTokenRegistryContract());

  const erc721TokenImpl = await deployer.deploy(ERC721MintableToken);

  const tokenPool = await tokenRegistry.TOKEN_CONTRACT();

  logger.logTransaction(
    await tokenRegistry.setNewImplementations([tokenPool], [erc721TokenImpl.address]),
    "Set Token implementation"
  );
};
