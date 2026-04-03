export interface CodexRouteState {
  initialPrompt: string | null;
  promptDecodeError: string | null;
}

export function parseCodexRouteState(search: string): CodexRouteState {
  const searchParams = new URLSearchParams(search);
  const encodedPrompt = searchParams.get('prompt');

  if (!encodedPrompt) {
    return {
      initialPrompt: null,
      promptDecodeError: null
    };
  }

  try {
    const initialPrompt = decodeBase64PromptParam(encodedPrompt);
    return {
      initialPrompt: initialPrompt.length > 0 ? initialPrompt : null,
      promptDecodeError: null
    };
  } catch (error) {
    return {
      initialPrompt: null,
      promptDecodeError: error instanceof Error ? error.message : 'Unable to decode the ?prompt= value.'
    };
  }
}

export function decodeBase64PromptParam(encodedPrompt: string) {
  const normalized = normalizeBase64(encodedPrompt);

  if (normalized.length === 0) {
    return '';
  }

  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function normalizeBase64(encodedPrompt: string) {
  const compact = encodedPrompt.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');

  if (!/^[A-Za-z0-9+/=]*$/.test(compact)) {
    throw new Error('The ?prompt= value is not valid base64.');
  }

  const paddingLength = (4 - (compact.length % 4)) % 4;
  return compact + '='.repeat(paddingLength);
}
