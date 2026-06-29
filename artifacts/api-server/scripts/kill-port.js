import { execSync } from "child_process";

function killApiServer() {
  try {
    execSync('pkill -9 -f "dist/index.mjs" 2>/dev/null', { stdio: "ignore" });
  } catch {}
  try {
    const out = execSync("ps -ef | grep \"dist/index.mjs\" | grep -v grep | awk '{print $2}'", { encoding: "utf-8" });
    const pids = out.trim().split(/\s+/).filter(Boolean);
    for (const pid of pids) {
      try { process.kill(parseInt(pid), "SIGKILL"); } catch {}
    }
    if (pids.length) console.log(`Killed api-server processes: ${pids.join(", ")}`);
    else console.log("No api-server process found");
  } catch {
    console.log("No api-server process found");
  }
}

killApiServer();
