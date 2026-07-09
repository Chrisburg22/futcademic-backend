import Anthropic from '@anthropic-ai/sdk';

// Cliente perezoso: no rompe el arranque del backend si falta la API key;
// solo falla al usar el chat.
let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Falta la variable de entorno ANTHROPIC_API_KEY.');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export const CHAT_MODEL = 'claude-haiku-4-5';
