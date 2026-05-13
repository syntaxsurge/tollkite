import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(`\nDeploying AgentRunAttestor to '${network.name}'...`);
  console.log(`Deployer: ${deployer.address}`);

  const AgentRunAttestor = await ethers.getContractFactory("AgentRunAttestor");
  const attestor = await AgentRunAttestor.deploy(deployer.address);

  await attestor.waitForDeployment();

  const attestorAddress = await attestor.getAddress();

  console.log(`AgentRunAttestor deployed at ${attestorAddress}`);
  console.log(`Set NEXT_PUBLIC_AGENT_ATTESTOR_ADDRESS=${attestorAddress} in the root app environment.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
