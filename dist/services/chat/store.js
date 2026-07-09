"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveMessage = saveMessage;
exports.loadHistory = loadHistory;
exports.setPending = setPending;
exports.clearPending = clearPending;
const supabase_1 = require("../../config/supabase");
const HISTORY_LIMIT = 30;
async function saveMessage(conversationId, role, content) {
    const { error } = await supabase_1.supabaseAdmin
        .from('chat_messages')
        .insert({ conversation_id: conversationId, role, content });
    if (error)
        throw new Error(`Error guardando mensaje: ${error.message}`);
    await supabase_1.supabaseAdmin
        .from('chat_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
}
/**
 * Reconstruye el historial como MessageParam[] para la API de Anthropic.
 * Toma los últimos N mensajes y recorta el inicio hasta un mensaje `user`
 * de texto plano, para no romper pares tool_use/tool_result.
 */
async function loadHistory(conversationId) {
    const { data, error } = await supabase_1.supabaseAdmin
        .from('chat_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT);
    if (error)
        throw new Error(`Error cargando historial: ${error.message}`);
    const rows = (data || []).reverse();
    // Primer mensaje válido: user sin bloques tool_result
    const startIdx = rows.findIndex((r) => {
        if (r.role !== 'user')
            return false;
        const blocks = Array.isArray(r.content) ? r.content : [];
        return !blocks.some((b) => b?.type === 'tool_result');
    });
    const usable = startIdx >= 0 ? rows.slice(startIdx) : rows;
    return usable.map((r) => ({
        role: r.role,
        content: r.content,
    }));
}
async function setPending(conversationId, state) {
    const { error } = await supabase_1.supabaseAdmin
        .from('chat_conversations')
        .update({ status: 'awaiting_confirmation', pending_state: state, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    if (error)
        throw new Error(`Error guardando estado pendiente: ${error.message}`);
}
async function clearPending(conversationId) {
    const { error } = await supabase_1.supabaseAdmin
        .from('chat_conversations')
        .update({ status: 'active', pending_state: null, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    if (error)
        throw new Error(`Error limpiando estado pendiente: ${error.message}`);
}
