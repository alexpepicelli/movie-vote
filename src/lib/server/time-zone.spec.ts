import { describe, expect, it } from 'vitest';
import { usableTimeZone } from './time-zone';

describe('usableTimeZone', () => {
	it('keeps a zone Intl recognises', () => {
		expect(usableTimeZone('Australia/Adelaide')).toBe('Australia/Adelaide');
	});

	it('falls back to UTC for one it does not', () => {
		expect(usableTimeZone('Etc/Unknown')).toBe('UTC');
		expect(usableTimeZone('Not/AZone')).toBe('UTC');
	});
});
