const Proxy = artifacts.require("PublicERC1967Proxy");
const ContractsRegistry = artifacts.require("ContractsRegistry");

const ERC721MintableToken = artifacts.require("ERC721MintableToken");
const TokenRegistry = artifacts.require("TokenRegistry");

module.exports = async (deployer, logger) => {
  const contractsRegistry = await ContractsRegistry.at((await Proxy.deployed()).address);

  const tokenRegistry = await TokenRegistry.at(await contractsRegistry.getTokenRegistryContract());

  const token = await deployer.deploy(ERC721MintableToken);

  const tokenPool = await tokenRegistry.TOKEN_POOL();

  logger.logTransaction(
    await tokenRegistry.setNewImplementations([tokenPool], [token.address]),
    "Set Token implementation"
  );
};
