const {assert} = require("chai");
const {wei, accounts, toBN} = require("../../scripts/utils/utils");
const {ZERO_ADDR, PRECISION, PERCENTAGE_100} = require("../../scripts/utils/constants");
const Reverter = require("../helpers/reverter");
const truffleAssert = require("truffle-assertions");
const {signPermit} = require("../helpers/signatures");

const ContractsRegistry = artifacts.require("ContractsRegistry");
const TokenFactory = artifacts.require("TokenFactory");
const TokenRegistry = artifacts.require("TokenRegistry");
const RoleManager = artifacts.require("RoleManager");
const ERC721MintableToken = artifacts.require("ERC721MintableToken");
const Marketplace = artifacts.require("Marketplace");
const Voucher = artifacts.require("Voucher");

describe("Voucher", () => {
  let OWNER;
  let SECOND;
  const OWNER_PK = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const USER1_PK = "0e48c6349e2619d39b0f2c19b63e650718903a3146c7fb71f4c7761147b2a10b";

  let voucher;
  let marketplace;
  let contractsRegistry;

  const defaultValue = toBN(100);
  const defaultEndTime = toBN(1000000000000);

  const reverter = new Reverter();

  function signPermitTest({
                            privateKey = OWNER_PK,
                            owner = OWNER,
                            spender = marketplace.address,
                            value = defaultValue.toFixed(),
                            deadline = defaultEndTime.toFixed(),
                          }) {
    const buffer = Buffer.from(privateKey, "hex");

    const domain = {
      name: "Voucher",
      verifyingContract: voucher.address,
    };

    const permit = {
      owner: owner,
      spender: spender,
      value: value,
      deadline: deadline,
    };

    return signPermit(domain, permit, buffer);
  }

  before("setup", async () => {
    OWNER = await accounts(0);
    SECOND = await accounts(1);

    voucher = await Voucher.new();
    await voucher.__Voucher_init("name", "symbol");


    // const _roleManager = await RoleManager.new();
    // contractsRegistry = await ContractsRegistry.new();
    marketplace = await Marketplace.new();

    // await contractsRegistry.__OwnableContractsRegistry_init();

    // await contractsRegistry.addProxyContract(await contractsRegistry.TOKEN_FACTORY_NAME(), _tokenFactory.address);
    // await contractsRegistry.addProxyContract(await contractsRegistry.TOKEN_REGISTRY_NAME(), _tokenRegistry.address);
    // await contractsRegistry.addProxyContract(await contractsRegistry.MARKETPLACE_NAME(), _marketplace.address);
    // await contractsRegistry.addProxyContract(await contractsRegistry.ROLE_MANAGER_NAME(), _roleManager.address);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  // describe("permit", () => {
  //   it("should permit", async () => {
  //     const sig = signPermitTest({});

  //     console.log("voucher", voucher.address);
  //     await voucher.permit(OWNER, marketplace.address, defaultValue.toFixed(), defaultEndTime.toFixed(), sig.v, sig.r, sig.s, { from: OWNER });

  //     assert.equal(await voucher.allowance(OWNER, marketplace.address), 100);
  //   });
  // });
});
