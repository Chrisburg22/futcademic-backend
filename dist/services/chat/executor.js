"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeTool = executeTool;
const tools_1 = require("./tools");
const MAX_RESULT_CHARS = 15000;
function internalApiUrl() {
    const port = process.env.PORT || 3000;
    return process.env.INTERNAL_API_URL || `http://127.0.0.1:${port}/api`;
}
/**
 * Ejecuta una tool haciendo una petición HTTP interna a la propia API,
 * reenviando el Bearer token del admin. Los middlewares (auth, tenant, rol)
 * se aplican igual que en cualquier petición del panel.
 */
async function executeTool(name, input, authHeader, ctx) {
    const route = (0, tools_1.toolRoute)(name, input || {}, ctx);
    if (!route) {
        return { content: `Herramienta desconocida: ${name}`, is_error: true };
    }
    let url = `${internalApiUrl()}${route.path}`;
    if (route.query && Object.keys(route.query).length > 0) {
        url += `?${new URLSearchParams(route.query).toString()}`;
    }
    try {
        const response = await fetch(url, {
            method: route.method,
            headers: {
                Authorization: authHeader,
                'Content-Type': 'application/json',
            },
            body: route.body !== undefined ? JSON.stringify(route.body) : undefined,
        });
        const text = await response.text();
        let content = text;
        try {
            // Re-serializar compacto si es JSON válido
            content = JSON.stringify(JSON.parse(text));
        }
        catch {
            // texto plano (204, CSV, etc.)
            if (!content)
                content = response.ok ? 'OK' : `Error HTTP ${response.status}`;
        }
        if (content.length > MAX_RESULT_CHARS) {
            content = `${content.slice(0, MAX_RESULT_CHARS)}… (resultado truncado)`;
        }
        return { content, is_error: !response.ok };
    }
    catch (err) {
        console.error(`[chat] Error ejecutando tool ${name}:`, err);
        return { content: `Error de red ejecutando la acción: ${err?.message || err}`, is_error: true };
    }
}
