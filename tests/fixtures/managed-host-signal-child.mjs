// TEST ONLY: loopback, fixed synthetic gateway, no credentials/model/provider.
import { createInterface } from "node:readline";
import { startManagedSummaryHost } from "../../scripts/managed-summary-host.mjs";
import { attachManagedSummarySignals } from "../../scripts/managed-summary-signals.mjs";
if (!import.meta.main) throw Error("test_fixture_requires_direct_execution");
const hold = process.argv[2] === "hold";
const emit = value => console.log(JSON.stringify(value));
const input = createInterface({ input: process.stdin });
let release;
input.on("line", line => { if (line === "release") release?.(); });
const host = startManagedSummaryHost({ origin: "https://summary.example.test", isReady: () => true,
  verifyPeer: peer => peer.address === "127.0.0.1",
  gateway: { handle: async request => {
    if (hold && new URL(request.url).pathname.endsWith("/generate")) {
      emit({ event: "generation_started" });
      await new Promise(resolve => { release = resolve; });
      return Response.json({ syntheticDraft: true });
    }
    return Response.json({ error: "authentication_required" }, { status: 401 });
  } },
  onStopped() { input.close(); process.stdin.pause(); emit({ event: "cleanup" }); },
});
attachManagedSummarySignals({ host, timeoutMs: hold ? 30 : 1000,
  onOutcome: outcome => emit({ event: "shutdown", ...outcome }) });
emit({ event: "ready", port: host.port });
