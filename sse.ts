
/**
 * Represents an event in the Server-Sent Events (SSE) protocol.
 */
export interface Event {
    /**
     * The type of the event.
     */
    event: string;

    /**
     * The data associated with the event, which can be an ArrayBuffer or ArrayBufferLike.
     */
    data: any;//string|boolean|number|object;

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
    /**
     * The writer used to write Event objects to the TransformStream.
     */
    private writer: WritableStreamDefaultWriter<Event>;

    /**
     * The readable stream that outputs Uint8Array chunks representing the SSE messages.
     */
    readable: ReadableStream<Uint8Array>;

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
        this.writer = trans.writable.getWriter();
        this.readable = trans.readable;
    };

    /**
     * Closes the writer, signaling that no more Event objects will be written.
     */
    close() {
        this.writer.close();
    }
    /**
     * Writes an Event object to the TransformStream.
     * @param chunk - The Event object to be written.
     */
    write(chunk: Event) {
        this.writer.write(chunk);
    }

    response(): Response {
        return new Response(this.readable, {
            headers: sseRequiredHeaders,
        });
    }
}

