/**
 * In-process pub/sub for live updates. Events only say *what* changed; browsers then reload
 * their own data, so nothing a viewer isn't allowed to see (like hidden tallies) goes out here.
 */
export type LiveEvent = { type: 'night'; nightId: string };

type Listener = (event: LiveEvent) => void;

// On globalThis so connections opened before a dev-server reload still get events.
const globals = globalThis as { __votarrListeners?: Set<Listener> };
const listeners = (globals.__votarrListeners ??= new Set());

export function subscribe(listener: Listener) {
	listeners.add(listener);
	return () => void listeners.delete(listener);
}

export function publish(event: LiveEvent) {
	for (const listener of listeners) {
		try {
			listener(event);
		} catch {
			// A dead connection mustn't stop the others getting the event.
		}
	}
}

export const nightChanged = (nightId: string) => publish({ type: 'night', nightId });

/** Open live-update connections, for the health page. */
export const listenerCount = () => listeners.size;
