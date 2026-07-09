"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHAT_MODEL = void 0;
exports.getAnthropic = getAnthropic;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
// Cliente perezoso: no rompe el arranque del backend si falta la API key;
// solo falla al usar el chat.
let client = null;
function getAnthropic() {
    if (!client) {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error('Falta la variable de entorno ANTHROPIC_API_KEY.');
        }
        client = new sdk_1.default({ apiKey });
    }
    return client;
}
exports.CHAT_MODEL = 'claude-opus-4-8';
