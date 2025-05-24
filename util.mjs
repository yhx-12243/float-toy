const { promise, resolve } = Promise.withResolvers();
document.addEventListener('DOMContentLoaded', resolve);

export const polyfill = (typeof Uint8Array.fromHex === 'function' && typeof Uint8Array.prototype.toHex === 'function'
	? Promise.resolve()
	: import('./es-arraybuffer-base64-polyfill.mjs'));

export { promise as DOMContentLoaded };
