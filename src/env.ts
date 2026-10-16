import { defineEnvVars } from '@sveltejs/kit/env';

const optionalUrl = (name: string) => (value: string | undefined) => {
	if (!value) return undefined;
	try {
		return new URL(value).toString().replace(/\/$/, '');
	} catch {
		throw new Error(`${name} must be a valid URL (got "${value}")`);
	}
};

const optional = (value: string | undefined) => value || undefined;

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'Path to the SQLite database file.',
		schema: (value) => value || './data/votarr.db'
	},
	SEERR_URL: {
		description: 'Internal URL of Seerr, e.g. http://seerr:5055',
		schema: optionalUrl('SEERR_URL')
	},
	SEERR_API_KEY: {
		description: 'Seerr API key (Settings → General).',
		schema: optional
	},
	RADARR_URL: {
		description: 'Internal URL of Radarr, e.g. http://radarr:7878',
		schema: optionalUrl('RADARR_URL')
	},
	RADARR_API_KEY: {
		description: 'Radarr API key (Settings → General).',
		schema: optional
	},
	DISCORD_WEBHOOK_URL: {
		description: 'Discord channel webhook for movie night notifications.',
		schema: optionalUrl('DISCORD_WEBHOOK_URL')
	},
	OWNER_SEERR_USER_ID: {
		description: 'Seerr user ID of the owner. If unset, the first user to sign in becomes owner.',
		schema: (value) => {
			if (!value) return undefined;
			const id = Number(value);
			if (!Number.isInteger(id)) throw new Error('OWNER_SEERR_USER_ID must be an integer');
			return id;
		}
	}
});
