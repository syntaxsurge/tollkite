import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(`\nDeploying ApiPaymentEscrow to '${network.name}'...`);
  console.log(`Deployer: ${deployer.address}`);

  const ApiPaymentEscrow = await ethers.getContractFactory("ApiPaymentEscrow");
  const escrow = await ApiPaymentEscrow.deploy(deployer.address);

  await escrow.waitForDeployment();

  const escrowAddress = await escrow.getAddress();

  console.log(`ApiPaymentEscrow deployed at ${escrowAddress}`);
  console.log(`Set NEXT_PUBLIC_API_PAYMENT_ESCROW_ADDRESS=${escrowAddress} in the root app environment.`);
  console.log("Set API_ESCROW_OPERATOR_PRIVATE_KEY to an account with OPERATOR_ROLE.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
