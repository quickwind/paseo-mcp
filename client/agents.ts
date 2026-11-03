import type { PluginClientContext } from "@getpaseo/plugin/client";

type Paseo = PluginClientContext["paseo"];
type AgentListOptions = NonNullable<Parameters<Paseo["agents"]["list"]>[0]>;
export type AgentList = Awaited<ReturnType<Paseo["agents"]["list"]>>;
export type AgentUpdate = Parameters<Parameters<Paseo["agents"]["subscribe"]>[0]>[0];

type AgentObservation = {
  subscribe(observer: {
    snapshot(snapshot: AgentList): void;
    update(message: { type: string; payload?: unknown }): void;
    error?(error: unknown): void;
  }): () => void;
  release(): Promise<void>;
};

type ObservingAgents = {
  list(
    options: AgentListOptions & { subscribe: {}; signal: AbortSignal },
  ): Promise<AgentList & { subscription?: AgentObservation }>;
};

const RETRY_MIN_MS = 2_000;
const RETRY_MAX_MS = 60_000;

export function canObserveAgents(paseo: Paseo): boolean {
  return typeof (paseo as { observeEvents?: unknown }).observeEvents === "function";
}

export function followAgents(
  paseo: Paseo,
  handlers: { snapshot(list: AgentList): void; update(update: AgentUpdate): void },
  legacy: () => () => void,
): () => void {
  if (!canObserveAgents(paseo)) return legacy();

  const lifetime = new AbortController();
  let observation: AgentObservation | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let retryDelay = RETRY_MIN_MS;

  function reopen(error: unknown): void {
    observation = null;
    if (lifetime.signal.aborted || retry !== null) return;
    console.warn("mcp: agent observation failed; reopening", error);
    retry = setTimeout(() => {
      retry = null;
      open();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
  }

  function open(): void {
    (paseo.agents as unknown as ObservingAgents)
      .list({ subscribe: {}, signal: lifetime.signal })
      .then(({ subscription }) => {
        if (lifetime.signal.aborted) return;
        if (subscription === undefined) throw new Error("the host returned no agent observation");
        observation = subscription;
        subscription.subscribe({
          snapshot(list) {
            retryDelay = RETRY_MIN_MS;
            handlers.snapshot(list);
          },
          update(message) {
            if (message.type === "agent_update") handlers.update(message.payload as AgentUpdate);
          },
          error: reopen,
        });
      })
      .catch(reopen);
  }

  open();
  return () => {
    lifetime.abort();
    if (retry !== null) clearTimeout(retry);
    retry = null;
    void observation?.release().catch(() => undefined);
    observation = null;
  };
}
