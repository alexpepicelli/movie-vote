/**
 * Movie night themes. A night stores one of these ids; the app sets `data-theme` on its root
 * and the matching block in `src/routes/themes.css` swaps the colours, fonts and scene art.
 *
 * To add a theme: add an entry here and copy a block in themes.css. Nothing else.
 */
export type Theme = {
	id: string;
	name: string;
	blurb: string;
	/** Three colours shown on the picker: main, accent, highlight. */
	swatch: [string, string, string];
};

export const THEMES = [
	{
		id: 'synthwave',
		name: 'Synthwave',
		blurb: 'Neon sunset and a drifting grid',
		swatch: ['#ff4f9a', '#ffb347', '#45e3ff']
	},
	{
		id: 'halloween',
		name: 'Halloween',
		blurb: 'Harvest moon, bats and gravestones',
		swatch: ['#ff7518', '#b5ff4a', '#8a4bff']
	},
	{
		id: 'christmas',
		name: 'Christmas',
		blurb: 'Snowfall, pine trees and a winter moon',
		swatch: ['#ff3b4e', '#ffd76a', '#2ee66b']
	}
] as const satisfies readonly Theme[];

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME: ThemeId = 'synthwave';

export const isTheme = (id: unknown): id is ThemeId => THEMES.some((t) => t.id === id);

/** Unknown or missing ids (e.g. a theme removed later) fall back to the default. */
export const resolveTheme = (id: unknown): ThemeId => (isTheme(id) ? id : DEFAULT_THEME);
