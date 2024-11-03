
/**
 * Represents an event in the Server-Sent Events (SSE) protocol.
 */
export interface Event {
    /**
     * The type of the event.
     */
    event?: string;

    /**
     * The data associated with the event, which can be an ArrayBuffer or ArrayBufferLike.
     */
    data: string | boolean | number | object;

    /**
     * An optional identifier for the event.
     */
    id?: number;
}



export const sseRequiredHeaders = {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    "connection": "keep-alive",
    "transfer-encoding": "chunked",
}

/**
 * The SSE class provides a way to create a server-sent events (SSE) stream.
 * It uses a TransformStream to convert Event objects into Uint8Array chunks
 * that can be read by a ReadableStream.
 */
export class SSE {
    trans: TransformStream<Event, Uint8Array>;


    /**
     * Constructs a new SSE instance, initializing the TransformStream and its writer.
     */
    constructor() {
        const encoder = new TextEncoder();
        const trans = new TransformStream<Event, Uint8Array>({
            transform(chunk, controller) {
                const lines = [];
                chunk.id && lines.push(`id: ${chunk.id}`);
                chunk.event && lines.push(`event: ${chunk.event}`);
                switch (typeof chunk.data) {
                    case "string":
                    case "boolean":
                    case "number":
                        lines.push(`data: ${chunk.data}`);
                        break;
                    case "object":
                        lines.push(`data: ${JSON.stringify(chunk.data)}`);
                        break;
                    default:
                        lines.push(`data: ${chunk.data || ''}`);
                }
                const message = encoder.encode(lines.join("\n") + "\n\n");
                controller.enqueue(message);
            }
        });
        this.trans = trans;
    };





    /**
     * Generates an HTTP response with the required headers for Server-Sent Events (SSE).
     *
     * @returns {Response} A new Response object with the readable stream and SSE headers.
     */
    response(source: ReadableStream<Event>): Response {
        const reader = source.pipeThrough(this.trans)
        return new Response(reader, {
            headers: sseRequiredHeaders,
            status: 200,
        });
    }
}

