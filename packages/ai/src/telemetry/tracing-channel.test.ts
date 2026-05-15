import { AsyncLocalStorage } from 'node:async_hooks';
import { tracingChannel } from 'node:diagnostics_channel';
import { describe, expect, it, afterEach } from 'vitest';
import { AI_SDK_TRACING_CHANNEL, trace } from './tracing-channel';

const channel = tracingChannel(AI_SDK_TRACING_CHANNEL);
const store = new AsyncLocalStorage<{ spanId: string }>();

afterEach(() => {
  store.disable();
});

describe('tracing channel context propagation', () => {
  it('propagates context for language model calls', async () => {
    let startContext: any;
    const subscribers = {
      start(ctx: any) {
        startContext = ctx;
      },
      end() {},
      asyncStart() {},
      asyncEnd() {},
      error() {},
    };
    channel.subscribe(subscribers);
    (channel.start as any).bindStore(store, (ctx: any) => ({
      spanId: `span-${ctx.callId}`,
    }));

    let captured: { spanId: string } | undefined;

    const result = await trace(
      { type: 'languageModelCall', callId: 'call-1' },
      async () => {
        captured = store.getStore();
        return 'model-result';
      },
    );

    expect(result).toBe('model-result');
    expect(startContext?.type).toBe('languageModelCall');
    expect(startContext?.callId).toBe('call-1');
    expect(captured?.spanId).toBe('span-call-1');

    channel.unsubscribe(subscribers);
  });

  it('propagates context for tool execution', async () => {
    let startContext: any;
    const subscribers = {
      start(ctx: any) {
        startContext = ctx;
      },
      end() {},
      asyncStart() {},
      asyncEnd() {},
      error() {},
    };
    channel.subscribe(subscribers);
    (channel.start as any).bindStore(store, (ctx: any) => ({
      spanId: `tool-${ctx.toolCallId}`,
    }));

    let captured: { spanId: string } | undefined;

    const result = await trace(
      { type: 'toolExecution', callId: 'call-1', toolCallId: 'tc-1' },
      async () => {
        captured = store.getStore();
        return 'tool-result';
      },
    );

    expect(result).toBe('tool-result');
    expect(startContext?.type).toBe('toolExecution');
    expect(startContext?.callId).toBe('call-1');
    expect(startContext?.toolCallId).toBe('tc-1');
    expect(captured?.spanId).toBe('tool-tc-1');

    channel.unsubscribe(subscribers);
  });

  it('propagates context for embed calls', async () => {
    let startContext: any;
    const subscribers = {
      start(ctx: any) {
        startContext = ctx;
      },
      end() {},
      asyncStart() {},
      asyncEnd() {},
      error() {},
    };
    channel.subscribe(subscribers);
    (channel.start as any).bindStore(store, (ctx: any) => ({
      spanId: `embed-${ctx.callId}`,
    }));

    let captured: { spanId: string } | undefined;

    const result = await trace(
      { type: 'embed', callId: 'embed-1' },
      async () => {
        captured = store.getStore();
        return 'embed-result';
      },
    );

    expect(result).toBe('embed-result');
    expect(startContext?.type).toBe('embed');
    expect(startContext?.callId).toBe('embed-1');
    expect(captured?.spanId).toBe('embed-embed-1');

    channel.unsubscribe(subscribers);
  });

  it('runs function directly when no subscribers', async () => {
    const result = await trace(
      { type: 'rerank', callId: 'rerank-1' },
      async () => 'rerank-result',
    );

    expect(result).toBe('rerank-result');
  });
});
