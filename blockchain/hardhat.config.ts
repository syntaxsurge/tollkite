import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-truffle5";
require("dotenv").config();

/* -------------------------------------------------------------------------- */
/*                               E N V  V A R S                               */
/* -------------------------------------------------------------------------- */

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";
const EVM_RPC_URL = process.env.EVM_RPC_URL ?? "https://rpc-testnet.gokite.ai/";
const EVM_CHAIN_ID = Number(process.env.EVM_CHAIN_ID ?? 2368);
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

/* -------------------------------------------------------------------------- */
/*                               H A R D H A T                                */
/* -------------------------------------------------------------------------- */

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.25",
    settings: {
      evmVersion: "london",
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    appChain: {
      url: EVM_RPC_URL,
      chainId: EVM_CHAIN_ID,
      accounts,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  typechain: { target: "truffle-v5" },
};

export default config;
