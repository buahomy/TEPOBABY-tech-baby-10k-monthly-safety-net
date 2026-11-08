// Runs `npm run relay` as a macOS background service (a LaunchAgent), so Ginny's Claude Code chat is
// online whenever you're logged in, with no Terminal window to keep open.
//
//   npm run relay:on       install and start it (it also starts at every login)
//   npm run relay:off      stop it and remove it
//   npm run relay:status   is it running? plus the last lines of its log
//
// launchd restarts the relay if it crashes or the Cloudflare tunnel drops (scripts/relay.mjs exits
// then). Logs go to ~/Library/Logs/tepobaby-relay.log.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LABEL = "com.tepobaby.relay";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plist = path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
const log = path.join(os.homedir(), "Library", "Logs", "tepobaby-relay.log");
const domain = `gui/${process.getuid()}`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// launchd starts with a bare PATH, so give it the folders node, claude and cloudflared live in.
const PATH = [path.dirname(process.execPath), path.join(os.homedir(), ".local", "bin"), "/usr/local/bin", "/opt/homebrew/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];

const launchctl = (...args) => {
  try {
    return execFileSync("launchctl", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    return `${err.stdout || ""}${err.stderr || ""}`;
  }
};

function on() {
  if (!fs.existsSync(path.join(repo, ".env.local"))) throw new Error(".env.local is missing: the relay needs CLAUDE_RELAY_SECRET.");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${esc(process.execPath)}</string>
    <string>--env-file=.env.local</string>
    <string>scripts/relay.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>${esc(repo)}</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>${esc([...new Set(PATH)].join(":"))}</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>${esc(log)}</string>
  <key>StandardErrorPath</key><string>${esc(log)}</string>
</dict>
</plist>
`;
  fs.mkdirSync(path.dirname(plist), { recursive: true });
  fs.mkdirSync(path.dirname(log), { recursive: true });
  launchctl("bootout", `${domain}/${LABEL}`); // replace an older copy, if any
  fs.writeFileSync(plist, xml);
  const out = launchctl("bootstrap", domain, plist);
  if (out.trim()) console.log(out.trim());
  console.log(`Relay service on. It starts at every login and restarts itself if it stops.\nLog: ${log}\nCheck it: npm run relay:status   Stop it for good: npm run relay:off`);
}

function off() {
  launchctl("bootout", `${domain}/${LABEL}`);
  fs.rmSync(plist, { force: true });
  console.log("Relay service off and removed. Ginny's Claude Code chat will show Mac offline.");
}

function status() {
  const info = launchctl("print", `${domain}/${LABEL}`);
  if (/could not find service/i.test(info) || !info.trim()) console.log("Relay service: not installed (npm run relay:on)");
  else {
    const state = info.match(/state = (\S+)/)?.[1] ?? "unknown";
    const pid = info.match(/pid = (\d+)/)?.[1];
    console.log(`Relay service: ${state}${pid ? ` (pid ${pid})` : ""}`);
  }
  if (fs.existsSync(log)) {
    const lines = fs.readFileSync(log, "utf8").trim().split("\n").slice(-8);
    console.log(`\nLast lines of ${log}:\n${lines.join("\n")}`);
  }
}

const cmd = process.argv[2];
if (cmd === "on") on();
else if (cmd === "off") off();
else if (cmd === "status") status();
else console.log("Usage: node scripts/relay-service.mjs on | off | status");
