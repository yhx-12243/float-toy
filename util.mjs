const { promise, resolve } = Promise.withResolvers();
document.addEventListener('DOMContentLoaded', resolve);

export const polyfill = (typeof Uint8Array.fromHex === 'function' && typeof Uint8Array.prototype.toHex === 'function'
	? Promise.resolve()
	: import('./es-arraybuffer-base64-polyfill.mjs'));

export { promise as DOMContentLoaded };

function stripTwo(/** @type {bigint} */ x) {
	let n = 0;
	for (; ;) {
		const y = Number(BigInt.asUintN(32, x));
		if (y) {
			const last = 31 - Math.clz32(y & -y);
			return [x >> BigInt(last), n + last];
		} else {
			x >>= 32n;
			n += 32;
		}
	}
}

function stripFive(/** @type {bigint} */ x) {
	if (x % 5n) return [x, 0];
	x /= 5n;
	let acc = 1, i = 0, P = 5n;
	const L = [];
	for (; !(x % P); ++i, P *= P)
		L.push(P), x /= P, acc += 1 << i;
	for (; i;)
		if (!(x % L[--i]))
			x /= L[i], acc += 1 << i;
	return [x, acc];
}

// Compute a / 10^bp.
export function reduceFraction(/** @type {bigint} */ a, /** @type {number} */ bp) {
	if (!a) return [0n, 1n];
	let n, m, b = 1n;
	[a, n] = stripTwo(a);
	[a, m] = stripFive(a);
	if (n >= bp) {
		a <<= BigInt(n - bp);
	} else {
		b <<= BigInt(bp - n);
	}
	if (m >= bp) {
		a *= 5n ** BigInt(m - bp);
	} else {
		b *= 5n ** BigInt(bp - m);
	}
	return [a, b];
}

export function shrTiesToEven(/** @type {bigint} */ a, /** @type {bigint} */ n) {
	if (n <= 0) return a >> n;
	const exotic = !(a & ((1n << (n - 1n)) - 1n));
	a >>= n - 1n;
	return (a + (exotic ? a & a >> 1n & 1n : 1n)) >> 1n;
}

export function divTiesToEven(/** @type {bigint} */ a, /** @type {bigint} */ b) {
	let q = (a + (b >> 1n)) / b;
	return a % b * 2n === b ? q & -2n : q;
}
