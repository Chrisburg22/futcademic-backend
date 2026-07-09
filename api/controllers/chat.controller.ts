import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../config/supabase';
import { createSSE } from '../services/chat/sse';
import { runAgentTurn } from '../services/chat/agent';
import { executeTool } from '../services/chat/executor';
import { toolLabel } from '../services/chat/tools';
import { saveMessage, loadHistory, clearPending, PendingState } from '../services/chat/store';

// ---------------------------------------------------------------------------
// Chat IA del admin. Todas las rutas van tras requireAuth + requireTenant +
// requireRole('super_admin', 'admin'). Los endpoints de mensajes responden
// por SSE (ver services/chat/sse.ts para el contrato de eventos).
// ---------------------------------------------------------------------------

async function findConversation(id: string, schoolId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('chat_conversations')
    .select('*')
    .eq('id', id)
    .eq('school_id', schoolId)
    .eq('user_id', userId)
    .single();
  return data;
}

async function getSchoolName(schoolId: string): Promise<string> {
  const { data } = await supabaseAdmin.from('schools').select('name').eq('id', schoolId).single();
  return data?.name || 'la academia';
}

function deniedResult(toolUseId: string, reason: string): Anthropic.ToolResultBlockParam {
  return { type: 'tool_result', tool_use_id: toolUseId, content: reason, is_error: true };
}

export const listConversations = async (req: Request, res: Response) => {
  try {
    const { school_id, user_id } = req.tenant!;
    const { data, error } = await supabaseAdmin
      .from('chat_conversations')
      .select('id, title, status, created_at, updated_at')
      .eq('school_id', school_id)
      .eq('user_id', user_id)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: 'Error listando conversaciones.', details: error.message });
    res.json(data);
  } catch (err) {
    console.error('listConversations error:', err);
    res.status(500).json({ error: 'Error listando conversaciones.' });
  }
};

export const getMessages = async (req: Request, res: Response) => {
  try {
    const { school_id, user_id } = req.tenant!;
    const conversation = await findConversation(req.params.id, school_id, user_id);
    if (!conversation) return res.status(404).json({ error: 'Conversación no encontrada.' });

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: 'Error cargando mensajes.', details: error.message });

    res.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        status: conversation.status,
        pending_state: conversation.pending_state,
      },
      messages: data,
    });
  } catch (err) {
    console.error('getMessages error:', err);
    res.status(500).json({ error: 'Error cargando mensajes.' });
  }
};

export const deleteConversation = async (req: Request, res: Response) => {
  try {
    const { school_id, user_id } = req.tenant!;
    const conversation = await findConversation(req.params.id, school_id, user_id);
    if (!conversation) return res.status(404).json({ error: 'Conversación no encontrada.' });

    const { error } = await supabaseAdmin.from('chat_conversations').delete().eq('id', conversation.id);
    if (error) return res.status(500).json({ error: 'Error eliminando conversación.', details: error.message });
    res.json({ message: 'Conversación eliminada.' });
  } catch (err) {
    console.error('deleteConversation error:', err);
    res.status(500).json({ error: 'Error eliminando conversación.' });
  }
};

/**
 * POST /chat/conversations/:id/messages  (":id" = "new" crea conversación)
 * Body: { message: string }. Respuesta: stream SSE.
 */
export const sendMessage = async (req: Request, res: Response) => {
  const { school_id, user_id, role } = req.tenant!;
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) return res.status(400).json({ error: 'El campo "message" es obligatorio.' });

  // Resolver/crear la conversación ANTES de abrir el stream (errores → JSON)
  let conversation: any;
  if (req.params.id === 'new') {
    const title = message.length > 60 ? `${message.slice(0, 57)}…` : message;
    const { data, error } = await supabaseAdmin
      .from('chat_conversations')
      .insert({ school_id, user_id, title })
      .select('*')
      .single();
    if (error || !data) {
      return res.status(500).json({ error: 'Error creando conversación.', details: error?.message });
    }
    conversation = data;
  } else {
    conversation = await findConversation(req.params.id, school_id, user_id);
    if (!conversation) return res.status(404).json({ error: 'Conversación no encontrada.' });
  }

  const sse = createSSE(res);
  sse.send('conversation', { id: conversation.id, title: conversation.title });

  try {
    // Si había una confirmación pendiente y el usuario escribió otra cosa,
    // se cancelan las acciones pendientes para no dejar tool_use sin respuesta.
    if (conversation.status === 'awaiting_confirmation' && conversation.pending_state) {
      const pending = conversation.pending_state as PendingState;
      const denied = pending.pending.map((p) =>
        deniedResult(p.tool_use_id, 'El usuario envió otro mensaje sin confirmar; la acción quedó cancelada.')
      );
      await saveMessage(conversation.id, 'user', [...pending.executed_results, ...denied]);
      await clearPending(conversation.id);
    }

    await saveMessage(conversation.id, 'user', [{ type: 'text', text: message }]);
    const messages = await loadHistory(conversation.id);
    const schoolName = await getSchoolName(school_id);

    await runAgentTurn({
      conversationId: conversation.id,
      messages,
      authHeader: req.headers.authorization!,
      ctx: { schoolId: school_id },
      schoolName,
      userRole: role,
      sse,
    });
  } catch (err: any) {
    console.error('sendMessage error:', err);
    sse.send('error', { message: err?.message || 'Error procesando el mensaje.' });
  } finally {
    sse.close();
  }
};

/**
 * POST /chat/conversations/:id/confirm
 * Body: { approved: boolean }. Ejecuta (o cancela) las acciones pendientes
 * y reanuda el turno del agente. Respuesta: stream SSE.
 */
export const resolveConfirmation = async (req: Request, res: Response) => {
  const { school_id, user_id, role } = req.tenant!;
  const approved = req.body?.approved === true;

  const conversation = await findConversation(req.params.id, school_id, user_id);
  if (!conversation) return res.status(404).json({ error: 'Conversación no encontrada.' });
  if (conversation.status !== 'awaiting_confirmation' || !conversation.pending_state) {
    return res.status(400).json({ error: 'No hay acciones pendientes de confirmación.' });
  }

  const pending = conversation.pending_state as PendingState;
  const sse = createSSE(res);
  sse.send('conversation', { id: conversation.id, title: conversation.title });

  try {
    const results: Anthropic.ToolResultBlockParam[] = [...(pending.executed_results || [])];

    for (const p of pending.pending) {
      if (approved) {
        sse.send('tool_start', { name: p.name, label: toolLabel(p.name, p.input) });
        const r = await executeTool(p.name, p.input, req.headers.authorization!, { schoolId: school_id });
        sse.send('tool_end', { name: p.name, ok: !r.is_error });
        results.push({ type: 'tool_result', tool_use_id: p.tool_use_id, content: r.content, is_error: r.is_error });
      } else {
        results.push(deniedResult(p.tool_use_id, 'El usuario canceló esta acción. No la vuelvas a intentar salvo que lo pida de nuevo.'));
      }
    }

    await saveMessage(conversation.id, 'user', results);
    await clearPending(conversation.id);

    const messages = await loadHistory(conversation.id);
    const schoolName = await getSchoolName(school_id);

    await runAgentTurn({
      conversationId: conversation.id,
      messages,
      authHeader: req.headers.authorization!,
      ctx: { schoolId: school_id },
      schoolName,
      userRole: role,
      sse,
    });
  } catch (err: any) {
    console.error('resolveConfirmation error:', err);
    sse.send('error', { message: err?.message || 'Error procesando la confirmación.' });
  } finally {
    sse.close();
  }
};
