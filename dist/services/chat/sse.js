"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSSE = createSSE;
/**
 * Prepara la respuesta como Server-Sent Events y devuelve un helper
 * para emitir eventos. Incluye heartbeat para que proxies (Render) no
 * corten la conexión por inactividad.
 */
function createSSE(res) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    let closed = false;
    const heartbeat = setInterval(() => {
        if (!closed)
            res.write(': ping\n\n');
    }, 15000);
    const stream = {
        get closed() {
            return closed;
        },
        send(event, data) {
            if (closed)
                return;
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        },
        close() {
            if (closed)
                return;
            closed = true;
            clearInterval(heartbeat);
            res.end();
        },
    };
    res.on('close', () => {
        closed = true;
        clearInterval(heartbeat);
    });
    return stream;
}
