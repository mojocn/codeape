import { Event, SSE } from './sse.ts';

function fetch(_req: Request) {
	const sse = new SSE();

	let timer: number | undefined = undefined;
	const body = new ReadableStream<Event>({
		start(controller) {
			timer = setInterval(() => {
				const message = `It is ${new Date().toString()}`;
				if (!controller.desiredSize) return; // Check if the stream is still writable
				controller.enqueue({ data: message });
			}, 1000);
			//stop timer in 10 seconds
			setTimeout(() => {
				clearInterval(timer);
				if (!controller.desiredSize) return; // Check if the stream is still writable

				controller.close();
			}, 10000);
		},
		cancel() {
			if (timer !== undefined) {
				clearInterval(timer);
			}
		},
	});

	return sse.response(body);
}

export default { fetch };

// deno serve -A sse_example.ts
