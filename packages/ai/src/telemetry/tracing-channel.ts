import { isNodeRuntime } from '../util/is-node-runtime';

type TracingChannelLike = {
  hasSubscribers: boolean;
  tracePromise(
    fn: (...args: any[]) => PromiseLike<any>,
    context?: unknown,
    thisArg?: unknown,
    ...args: any[]
  ): PromiseLike<any>;
};

let channelCache: Promise<Record<string, any> | undefined> | undefined;

async function loadDiagnosticsChannelModule(): Promise<
  Record<string, any> | undefined
> {
  if (!isNodeRuntime()) return undefined;
  if (channelCache == null) {
    channelCache = import(
      /* webpackIgnore: true */
      'node:diagnostics_channel'
    ).catch(() => undefined);
  }
  return channelCache;
}

export const AI_SDK_TRACING_CHANNEL = 'aisdk:telemetry';

let channel: TracingChannelLike | undefined | null;

async function getChannel(): Promise<TracingChannelLike | undefined> {
  if (channel === undefined) {
    const dc = await loadDiagnosticsChannelModule();
    channel =
      typeof dc?.tracingChannel === 'function'
        ? (dc.tracingChannel(AI_SDK_TRACING_CHANNEL) as TracingChannelLike)
        : null;
  }
  return channel ?? undefined;
}

export type TracingChannelContext =
  | { type: 'operation'; operationId: string; callId: string }
  | { type: 'step'; callId: string; stepNumber: number }
  | { type: 'languageModelCall'; callId: string }
  | { type: 'toolExecution'; callId: string; toolCallId: string }
  | { type: 'objectStep'; callId: string }
  | { type: 'embed'; callId: string }
  | { type: 'rerank'; callId: string };

// hasSubscribers is undefined on Node 18 (the aggregated getter doesn't exist).
// Check !== false so we trace when unsure rather than silently skipping.
function shouldTrace(
  ch: TracingChannelLike | undefined | null,
): ch is TracingChannelLike {
  return ch != null && ch.hasSubscribers !== false;
}

export async function trace<T>(
  contextFactory: () => TracingChannelContext,
  fn: () => PromiseLike<T>,
): Promise<T> {
  const ch = await getChannel();
  if (shouldTrace(ch)) {
    return ch.tracePromise(fn, contextFactory());
  }
  return fn();
}
