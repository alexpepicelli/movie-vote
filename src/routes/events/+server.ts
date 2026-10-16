import { subscribe, type LiveEvent } from '#lib/server/events.js';
import type { RequestHandler } from './$types';

/** Cloudflare drops connections idle for ~100s, so ping well inside that. */
const HEARTBEAT_MS = 30_000;

/** Server-Sent Events stream of live updates for signed-in users (hooks.server.ts guards it). */
export const GET: RequestHandler = ({ request }) => {
	const encoder = new TextEncoder();
	let cleanup = () => {};

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const send = (text: string) => {
				try {
					controller.enqueue(encoder.encode(text));
				} catch {
					cleanup();
				}
			};
			const onEvent = (event: LiveEvent) =>
				send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);

			const unsubscribe = subscribe(onEvent);
			const heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);
			cleanup = () => {
				clearInterval(heartbeat);
				unsubscribe();
			};
			request.signal.addEventListener('abort', () => {
				cleanup();
				try {
					controller.close();
				} catch {
					// already closed
				}
			});

			send('retry: 5000\n\n');
		},
		cancel() {
			cleanup();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
