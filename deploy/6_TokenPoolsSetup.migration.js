const ContractsRegistry = artifacts.require("ContractsRegistry");
const TokenRegistry = artifacts.require("TokenRegistry");

const ERC721MintableToken = artifacts.require("ERC721MintableToken");
const Voucher = artifacts.require("Voucher");

module.exports = async (deployer, logger) => {
  const contractsRegistry = await ContractsRegistry.deployed();

  const tokenRegistry = await TokenRegistry.at(await contractsRegistry.getTokenRegistryContract());

  const erc721TokenImpl = await deployer.deploy(ERC721MintableToken);
  const voucherImpl = await deployer.deploy(Voucher);

  const tokenPool = await tokenRegistry.TOKEN_CONTRACT();
  const voucherPool = await tokenRegistry.VOUCHER_TOKEN();

  logger.logTransaction(
    await tokenRegistry.setNewImplementations([tokenPool, voucherPool], [erc721TokenImpl.address, voucherImpl.address]),
    "Set Token and Voucher implementation"
  );
};
