import { describe, expect, it } from 'vitest';
import { decodeBase64PromptParam, parseCodexRouteState } from './CodexRouteState';

describe('CodexRouteState', () => {
  it('decodes a standard base64 prompt payload', () => {
    expect(decodeBase64PromptParam('SGVsbG8sIENvZGV4IQ==')).toBe('Hello, Codex!');
  });

  it('decodes a URL-safe UTF-8 base64 prompt payload', () => {
    const encodedPrompt = toBase64Url('Build /codex with subagents');
    expect(parseCodexRouteState(`?prompt=${encodedPrompt}`)).toEqual({
      initialPrompt: 'Build /codex with subagents',
      promptDecodeError: null
    });
  });

  it('returns a readable error for invalid base64 prompt payloads', () => {
    expect(parseCodexRouteState('?prompt=***')).toEqual({
      initialPrompt: null,
      promptDecodeError: 'The ?prompt= value is not valid base64.'
    });
  });
});

function toBase64Url(value: string) {
  const encoded = btoa(unescape(encodeURIComponent(value)));
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
