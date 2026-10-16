import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const argon2Async = promisify(argon2);

// OWASP minimum recommendation for argon2id: 19 MiB, 2 passes, 1 lane.
const PARAMS = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 };

/** Hashes a password into a PHC string: $argon2id$v=19$m=…,t=…,p=…$salt$hash */
export async function hashPassword(password: string): Promise<string> {
	const nonce = randomBytes(16);
	const hash = await argon2Async('argon2id', { ...PARAMS, message: password, nonce });
	return `$argon2id$v=19$m=${PARAMS.memory},t=${PARAMS.passes},p=${PARAMS.parallelism}$${b64(nonce)}$${b64(hash)}`;
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
	const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/.exec(stored);
	if (!match) return false;

	const [, memory, passes, parallelism, salt, expected] = match;
	const expectedBytes = Buffer.from(expected, 'base64');
	const hash = await argon2Async('argon2id', {
		message: password,
		nonce: Buffer.from(salt, 'base64'),
		memory: Number(memory),
		passes: Number(passes),
		parallelism: Number(parallelism),
		tagLength: expectedBytes.length
	});
	return timingSafeEqual(hash, expectedBytes);
}

const b64 = (buf: Buffer) => buf.toString('base64').replace(/=+$/, '');
