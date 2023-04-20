# NFT Books contracts V2

This repository contains the smart contracts for the NFT Books V2.

## Install Dependencies

`npm install`

## Compile Contracts

`npm run compile`

## Run Tests

`npm run test`

## Deployment

Before deploying, you need to create an **.env** file following the example of **.env.example**

Contents of **.env.example**:

```bash
# Deployer private key
PRIVATE_KEY=YOUR PRIVATE KEY

# RPC Endpoints
INFURA_KEY=INFURA PROJECT ID

# Additional keys
ETHERSCAN_KEY=ETHERSCAN API KEY
POLYGON_KEY=POLYGON API KEY

# Available targets: 'ethers-v5', 'truffle-v5' and 'web3-v1'
# By default 'ethers-v5'
TYPECHAIN_TARGET=TYPECHAIN TARGET
```

Next, you need to fill out file **deploy/data/config.json**, which is the configuration for the **Marketplace** and **RoleManager** contracts deployment

Example of **config.json**:

```json
{
    "baseTokenContractsURI": "baseURI",
    "roles": [
        {
            "roleKey": "ADMINISTRATOR_ROLE",
            "roleAdminKey": "ADMINISTRATOR_ROLE",
            "roleName": "Administrator",
            "members": []
        },
        {
            "roleKey": "ROLE_SUPERVISOR",
            "roleAdminKey": "ADMINISTRATOR_ROLE",
            "roleName": "Role Supervisor",
            "members": []
        },
        {
            "roleKey": "TOKEN_FACTORY_MANAGER",
            "roleAdminKey": "ROLE_SUPERVISOR",
            "roleName": "Token Factory Manager",
            "members": []
        },
        {
            "roleKey": "TOKEN_REGISTRY_MANAGER",
            "roleAdminKey": "ROLE_SUPERVISOR",
            "roleName": "Token Registry Manager",
            "members": []
        },
        {
            "roleKey": "TOKEN_MANAGER",
            "roleAdminKey": "ROLE_SUPERVISOR",
            "roleName": "Token Manager",
            "members": []
        },
        {
            "roleKey": "WITHDRAWAL_MANAGER",
            "roleAdminKey": "ROLE_SUPERVISOR",
            "roleName": "Withdrawal Manager",
            "members": []
        },
        {
            "roleKey": "MARKETPLACE_MANAGER",
            "roleAdminKey": "ROLE_SUPERVISOR",
            "roleName": "Marketplace Manager",
            "members": []
        },
        {
            "roleKey": "SIGNATURE_MANAGER",
            "roleAdminKey": "ROLE_SUPERVISOR",
            "roleName": "Signature Manager",
            "members": []
        }
    ]
}
```

Next, call command `npm run deploy <network>` (**network** is the name of the network, which should be in **hardhat.config.js**)

## Verifing

To verify the contract you must use the command `npx hardhat --network <network> verify --constructor-args constructorArgs.js <contract-address>`. Where:

- Contract address - deployed contract address
- Network - the network to which the contract was attached
- ConstructorArgs.js - file with constructor arguments of the deployed contract

Or set up **CONFIRMATIONS** and **VERIFY** fields in your **.env** file for autoverification during deployment
