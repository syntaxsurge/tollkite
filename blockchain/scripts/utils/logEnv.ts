import * as fs from "fs";
import * as path from "path";

/**
 * Append or update a KEY=value entry inside&nbsp;deployment.log so the file can be
 * copied straight into the main .env.  Multiple script runs safely overwrite the
 * same key without duplicating lines.
 *
 * @param key   Environment-style variable name (e.g. NEXT_PUBLIC_DID_REGISTRY_ADDRESS)
 * @param value Deployed value to persist
 */
export function updateEnvLog(key: string, value: string): void {
  const logPath = path.resolve(process.cwd(), "deployment.log");

  let content = "";
  if (fs.existsSync(logPath)) {
    content = fs.readFileSync(logPath, "utf8");
    const pattern = new RegExp(`^${key}=.*$`, "m");
    if (pattern.test(content)) {
      content = content.replace(pattern, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  } else {
    /* File does not exist – add a friendly banner then first key */
    const banner = "# Deployed contract addresses\n";
    content = `${banner}${key}=${value}`;
  }

  fs.writeFileSync(logPath, content);
}
