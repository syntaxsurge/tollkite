import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(`\nDeploying AgentRunVault to '${network.name}'...`);
  console.log(`Deployer: ${deployer.address}`);

  const AgentRunVault = await ethers.getContractFactory("AgentRunVault");
  const vault = await AgentRunVault.deploy(deployer.address);

  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();

  console.log(`AgentRunVault deployed at ${vaultAddress}`);
  console.log(`Set NEXT_PUBLIC_AGENT_RUN_VAULT_ADDRESS=${vaultAddress} in the root app environment.`);
  console.log("Set AGENT_RUN_VAULT_OPERATOR_PRIVATE_KEY to an account with OPERATOR_ROLE.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
