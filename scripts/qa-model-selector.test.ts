import { describe, expect, test } from 'bun:test';
import { detectProvider, inferUnderlyingProvider } from './model-catalog.ts';
import { filterModelsForCli, toHarnessModelId } from './qa-model-selector.ts';

describe('detectProvider', () => {
  test('known endpoints map to the right provider', () => {
    expect(detectProvider('https://opencode.ai/zen/go/v1/models')).toBe('opencode-go');
    expect(detectProvider('https://opencode.ai/zen/v1/models')).toBe('opencode');
    expect(detectProvider('https://generativelanguage.googleapis.com/v1beta/models')).toBe('google');
    expect(detectProvider('https://api.anthropic.com/v1/models')).toBe('anthropic');
    expect(detectProvider('https://api.openai.com/v1/models')).toBe('openai-direct');
    expect(detectProvider('https://api.deepseek.com/models')).toBe('deepseek');
    expect(detectProvider('https://api.moonshot.cn/v1/models')).toBe('kimi');
    expect(detectProvider('https://example.com/unknown')).toBe('custom');
  });

  test('OPENAI_API_BASE proxy is recognized as openai-direct', () => {
    const prev = process.env.OPENAI_API_BASE;
    process.env.OPENAI_API_BASE = 'https://my-proxy.example.com/v1';
    try {
      expect(detectProvider('https://my-proxy.example.com/v1/models')).toBe('openai-direct');
    }
    finally {
      if (prev === undefined) { delete process.env.OPENAI_API_BASE; }
      else { process.env.OPENAI_API_BASE = prev; }
    }
  });
});

describe('inferUnderlyingProvider', () => {
  test('strips any provider prefix and resolves the vendor', () => {
    expect(inferUnderlyingProvider('opencode/claude-opus-5')).toBe('anthropic');
    expect(inferUnderlyingProvider('anthropic/claude-3-5-sonnet')).toBe('anthropic');
    expect(inferUnderlyingProvider('openai/gpt-4')).toBe('openai');
    expect(inferUnderlyingProvider('opencode-go/deepseek-v4-pro')).toBe('deepseek');
    expect(inferUnderlyingProvider('deepseek/deepseek-chat')).toBe('deepseek');
    expect(inferUnderlyingProvider('google/gemini-2.5-flash')).toBe('google');
    expect(inferUnderlyingProvider('opencode/mimo-v2.5-free')).toBe('opencode');
  });
});

describe('toHarnessModelId', () => {
  test('opencode/codex keep the catalog id as-is', () => {
    expect(toHarnessModelId('opencode', 'opencode/claude-opus-5')).toBe('opencode/claude-opus-5');
    expect(toHarnessModelId('codex', 'openai/gpt-5')).toBe('openai/gpt-5');
  });
  test('claude-code maps to short aliases', () => {
    expect(toHarnessModelId('claude-code', 'opencode/claude-opus-5')).toBe('opus');
    expect(toHarnessModelId('claude-code', 'opencode/claude-sonnet-5')).toBe('sonnet');
    expect(toHarnessModelId('claude-code', 'opencode/claude-haiku-4-5')).toBe('haiku');
  });
});

describe('filterModelsForCli', () => {
  const models = [
    { id: 'opencode/claude-opus-5', name: 'Claude Opus 5', provider: 'anthropic', source: 'z', capabilities: [] },
    { id: 'openai/gpt-4', name: 'GPT-4', provider: 'openai', source: 'z', capabilities: [] },
    { id: 'opencode-go/deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'opencode', source: 'z', capabilities: [] },
  ];
  test('claude-code keeps only anthropic models', () => {
    expect(filterModelsForCli(models, 'claude-code').map(m => m.id)).toEqual(['opencode/claude-opus-5']);
  });
  test('codex keeps only openai models', () => {
    expect(filterModelsForCli(models, 'codex').map(m => m.id)).toEqual(['openai/gpt-4']);
  });
  test('opencode keeps everything', () => {
    expect(filterModelsForCli(models, 'opencode').map(m => m.id)).toHaveLength(3);
  });
});
