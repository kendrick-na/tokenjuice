// Opt-in signal wiring. Importing this file never changes process handlers.
// Does not force exit/kill, retry provider calls, reset budgets or print errors.
const installed = new WeakSet();
export function attachManagedSummarySignals({ host, target = process, timeoutMs = 30000, onOutcome = () => {} } = {}) {
  if (typeof host?.stop !== "function" || typeof target?.on !== "function" || typeof target?.removeListener !== "function"
    || typeof onOutcome !== "function" || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000
    || installed.has(target)) throw Error("invalid_managed_signal_config");
  let pending = false, removed = false;
  const handlers = new Map();
  async function stop(signal) {
    if (pending || removed) return;
    pending = true;
    let stopped = false;
    try { stopped = (await host.stop(timeoutMs))?.stopped === true; } catch { /* unknown, never complete */ }
    if (!removed) try {
      const result = onOutcome(Object.freeze({ signal, stopped }));
      if (result && typeof result.then === "function") Promise.resolve(result).catch(() => {});
    } catch { /* contain observer failure without forcing exit or reflecting details */ }
    pending = false;
  }
  try {
    for (const signal of ["SIGINT", "SIGTERM"]) {
      const listener = () => { void stop(signal); };
      handlers.set(signal, listener); target.on(signal, listener);
    }
    installed.add(target);
  } catch {
    for (const [signal, listener] of handlers) target.removeListener(signal, listener);
    throw Error("managed_signal_install_failed");
  }
  return {
    dispose() {
      if (removed) return;
      removed = true;
      for (const [signal, listener] of handlers) target.removeListener(signal, listener);
      installed.delete(target);
      // Does not undo or cancel an already accepted stop operation.
    },
  };
}
