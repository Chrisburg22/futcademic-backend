import Anthropic from '@anthropic-ai/sdk';
import { getAnthropic, CHAT_MODEL } from '../../config/anthropic';
import { CHAT_TOOLS, SENSITIVE_TOOLS, toolLabel, ToolContext } from './tools';
import { executeTool } from './executor';
import { saveMessage, setPending } from './store';
import { SSEStream } from './sse';

const MAX_ITERATIONS = 15;
const MAX_TOKENS = 16000;

export interface AgentTurnParams {
  conversationId: string;
  /** Historial completo reconstruido, terminando en un mensaje user */
  messages: Anthropic.MessageParam[];
  /** Header Authorization original del admin (se reenvía a la API interna) */
  authHeader: string;
  ctx: ToolContext;
  schoolName: string;
  userRole: string;
  sse: SSEStream;
}

function buildSystemPrompt(schoolName: string, userRole: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Eres el asistente administrativo de "${schoolName}", una academia de fútbol gestionada con Futcademic. Hablas con un usuario con rol ${userRole} y ejecutas sus órdenes usando las herramientas disponibles (alumnos, categorías, pagos, eventos, asistencias, sedes, invitaciones).

Reglas:
- Responde siempre en español, de forma breve y natural. Resume los resultados de las herramientas en lenguaje claro; nunca muestres JSON crudo ni UUIDs salvo que te los pidan.
- Nunca inventes UUIDs. Si necesitas el ID de un alumno, categoría, profesor o sede, consúltalo primero con la herramienta de listado correspondiente.
- Si el nombre que te dan coincide con varios registros, pregunta cuál antes de actuar.
- Las acciones marcadas como sensibles (pagos, eliminaciones, invitaciones) las confirmará el usuario en la interfaz antes de ejecutarse; pídelas con normalidad cuando el usuario las solicite.
- Si una herramienta devuelve error, explica el problema en lenguaje claro y sugiere cómo resolverlo.
- Formatea montos como moneda local (ej. $1,500) y fechas en formato legible (ej. 9 de julio de 2026).

Fecha de hoy: ${today}.`;
}

/**
 * Loop agéntico manual con streaming SSE. Ejecuta tools seguras directo;
 * al encontrar tools sensibles pausa el turno, persiste el estado pendiente
 * y emite `confirmation_required` para que el usuario decida.
 */
export async function runAgentTurn(params: AgentTurnParams): Promise<void> {
  const { conversationId, messages, authHeader, ctx, schoolName, userRole, sse } = params;
  const anthropic = getAnthropic();
  const system = buildSystemPrompt(schoolName, userRole);

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const stream = anthropic.messages.stream({
      model: CHAT_MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      tools: CHAT_TOOLS,
      messages,
    });

    stream.on('text', (delta) => sse.send('text_delta', { text: delta }));

    const final = await stream.finalMessage();

    // Persistir el mensaje assistant con los content blocks completos
    // (incluye thinking y tool_use — necesarios para reanudar el loop).
    await saveMessage(conversationId, 'assistant', final.content);
    messages.push({ role: 'assistant', content: final.content });

    if (final.stop_reason !== 'tool_use') {
      sse.send('done', {});
      return;
    }

    const toolUses = final.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );
    const safe = toolUses.filter((t) => !SENSITIVE_TOOLS.has(t.name));
    const sensitive = toolUses.filter((t) => SENSITIVE_TOOLS.has(t.name));

    // Ejecutar las tools seguras de inmediato
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const t of safe) {
      const input = (t.input || {}) as Record<string, any>;
      sse.send('tool_start', { name: t.name, label: toolLabel(t.name, input) });
      const r = await executeTool(t.name, input, authHeader, ctx);
      sse.send('tool_end', { name: t.name, ok: !r.is_error });
      results.push({ type: 'tool_result', tool_use_id: t.id, content: r.content, is_error: r.is_error });
    }

    if (sensitive.length > 0) {
      // Pausar: guardar resultados parciales + acciones pendientes y cerrar
      const pending = sensitive.map((t) => {
        const input = (t.input || {}) as Record<string, any>;
        return { tool_use_id: t.id, name: t.name, input, label: toolLabel(t.name, input) };
      });
      await setPending(conversationId, { executed_results: results, pending });
      sse.send('confirmation_required', { actions: pending });
      sse.send('done', { awaiting_confirmation: true });
      return;
    }

    // TODOS los tool_result en UN solo mensaje user
    await saveMessage(conversationId, 'user', results);
    messages.push({ role: 'user', content: results });
  }

  // Guardarraíl de iteraciones
  const limitNote = 'Se alcanzó el límite de acciones por turno. Escribe otro mensaje para continuar.';
  await saveMessage(conversationId, 'assistant', [{ type: 'text', text: limitNote }]);
  sse.send('text_delta', { text: limitNote });
  sse.send('done', {});
}
