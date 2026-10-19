<script lang="ts">
	import { onMount } from 'svelte';

	// The 80s perspective floor that drifts toward the viewer. Drawn on a canvas because the
	// CSS version (a masked plane under a 3D transform) flickers in Chrome's compositor.
	// `depth` is the floor's length before it's tilted away, in px.
	// `tilt` (degrees) and `perspective` shape the floor; `height` reports how tall it ends up.
	let {
		depth = 64,
		tilt = 58,
		perspective = 170,
		// eslint-disable-next-line no-useless-assignment -- written by the effect below for bind:height
		height = $bindable(),
		class: className = ''
	}: {
		depth?: number;
		tilt?: number;
		perspective?: number;
		height?: number;
		class?: string;
	} = $props();

	const CELL = 30;
	const LINE = 1.5;
	const PERIOD_MS = 1400;
	// The floor fades in from the horizon, fully opaque 65% of the way toward the viewer.
	const FADE = 0.65;

	const cos = $derived(Math.cos((tilt * Math.PI) / 180));
	const sin = $derived(Math.sin((tilt * Math.PI) / 180));
	// How much a point `d` px along the floor shrinks, and how high above the bottom it lands.
	const scaleAt = (d: number) => perspective / (perspective + d * sin);
	const riseAt = (d: number) => d * cos * scaleAt(d);

	const floorH = $derived(riseAt(depth));
	$effect(() => {
		height = floorH;
	});

	let canvas: HTMLCanvasElement;

	onMount(() => {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		let width = 0;
		let frame = 0;

		const draw = (now: number) => {
			const h = riseAt(depth);
			const dpr = devicePixelRatio || 1;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, width, h);
			ctx.globalCompositeOperation = 'source-over';
			// The floor takes its colour from the night's theme.
			const color = `rgb(${getComputedStyle(canvas).getPropertyValue('--grid-rgb')} / 0.4)`;
			ctx.fillStyle = color;
			ctx.strokeStyle = color;

			const cx = width / 2;
			const toY = (d: number) => h - riseAt(d);
			const toX = (x: number, d: number) => cx + (x - cx) * scaleAt(d);

			// Cross lines drift toward the viewer by one cell per period.
			const shift = still ? 0 : ((now % PERIOD_MS) / PERIOD_MS) * CELL;
			for (let top = shift - CELL; top < depth; top += CELL) {
				const far = depth - top;
				const near = Math.max(far - LINE, 0);
				if (far <= 0 || near >= depth) continue;
				const y0 = toY(Math.min(far, depth));
				ctx.fillRect(0, y0, width, toY(near) - y0);
			}

			// Rails converge on the vanishing point; the plane is twice the card's width.
			ctx.lineWidth = LINE;
			ctx.beginPath();
			for (let x = -width / 2; x <= width * 1.5; x += CELL) {
				const rail = x + LINE / 2;
				ctx.moveTo(toX(rail, 0), h);
				ctx.lineTo(toX(rail, depth), 0);
			}
			ctx.stroke();

			// Fade toward the horizon, measured along the floor rather than on screen.
			const fade = ctx.createLinearGradient(0, 0, 0, h);
			for (let i = 0; i <= 8; i++) {
				const fromTop = (depth * FADE * i) / 8;
				fade.addColorStop(Math.min(toY(depth - fromTop) / h, 1), `rgba(0,0,0,${i / 8})`);
			}
			ctx.globalCompositeOperation = 'destination-in';
			ctx.fillStyle = fade;
			ctx.fillRect(0, 0, width, h);

			if (!still) frame = requestAnimationFrame(draw);
		};

		const resize = () => {
			const dpr = devicePixelRatio || 1;
			width = canvas.clientWidth;
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(riseAt(depth) * dpr);
			if (still) draw(0);
		};

		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		resize();
		if (!still) frame = requestAnimationFrame(draw);

		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
		};
	});
</script>

<canvas
	bind:this={canvas}
	class="absolute inset-x-0 bottom-0 w-full {className}"
	style:height="{floorH}px"
	aria-hidden="true"
></canvas>
