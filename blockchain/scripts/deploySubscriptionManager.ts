import { ethers, network, run } from "hardhat";

import { adminAddress, platformAddress } from "./config";
import { updateEnvLog } from "./utils/logEnv";

async function main(): Promise<void> {
  console.log(`\nDeploying SubscriptionManager to '${network.name}'...`);

  /* ------------------------------------------------------------------ */
  /*                  Plan prices configured via env vars               */
  /* ------------------------------------------------------------------ */
  const basePriceEnv = process.env.SUBSCRIPTION_PRICE_WEI_BASE;
  const plusPriceEnv = process.env.SUBSCRIPTION_PRICE_WEI_PLUS;

  if (!basePriceEnv || !plusPriceEnv) {
    throw new Error("Missing SUBSCRIPTION_PRICE_WEI_BASE or SUBSCRIPTION_PRICE_WEI_PLUS environment variables");
  }

  const basePrice = BigInt(basePriceEnv);
  const plusPrice = BigInt(plusPriceEnv);

  const args: [string, bigint, bigint] = [adminAddress, basePrice, plusPrice];
  const SubscriptionManager = await ethers.getContractFactory("SubscriptionManager");
  const mgr = await SubscriptionManager.deploy(...args);
  await mgr.waitForDeployment();

  const managerAddress = await mgr.getAddress();
  console.log(`SubscriptionManager deployed at ${managerAddress}`);

  /* Persist address for env ------------------------------------------ */
  updateEnvLog("NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS", managerAddress);

  /* ------------------------------ Verify ----------------------------- */
  if (!["hardhat", "localhost"].includes(network.name)) {
    try {
      await run("verify:verify", {
        address: managerAddress,
        constructorArguments: args,
      });
      console.log("🔎  Verified on explorer");
    } catch (err) {
      console.warn("⚠️   Verification skipped / failed:", (err as Error).message);
    }
  }

  /* ------------------------- Grant ADMIN_ROLE ------------------------ */
  const ADMIN_ROLE = await mgr.ADMIN_ROLE();
  const grantRoleTx = await mgr.grantRole(ADMIN_ROLE, platformAddress);
  await grantRoleTx.wait();
  console.log(`ADMIN_ROLE granted to ${platformAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
