import { SEMFloatBase } from './abc.mjs';

export class SEMFloat extends SEMFloatBase {
	buffer8 = new BigUint64Array(1);

	constructor(/** @type {number} */ exponentBits, /** @type {number} */ mantissaBits, exponentExcess = 1n - (1n << BigInt(exponentBits - 1))) {
		if (exponentBits > 11 || mantissaBits > 52)
			throw new RangeError(`Invalid SEMFloat parameters: exponentBits=${exponentBits}, mantissaBits=${mantissaBits}`);
		super(exponentBits, mantissaBits, exponentExcess);
	}

	/* override */ getMantissa(/** @type {bigint} */ mantissa, subnormal = false) {
		this.buffer8[0] = 0x3ff0000000000000n | mantissa << BigInt(52 - this.mantissaBits);
		return new Float64Array(this.buffer8.buffer)[0] - subnormal;
	}

	/* override */ getFloat() {
		new Uint8Array(this.buffer8.buffer).set(this.buffer);
		const
			M = ((1n << BigInt(this.mantissaBits)) - 1n),
			[sign, exponent, mantissa] = this.decomposeSEM(this.buffer8[0]);
		let exponent_64, mantissa_64 = mantissa;
		if (exponent >= (1n << BigInt(this.exponentBits)) - 1n) { // inf, nan
			exponent_64 = 2047n;
			mantissa_64 = (mantissa ? 1n << BigInt(this.mantissaBits - 1) : 0n);
		} else if (!exponent) {
			if (mantissa) { // subnormal
				exponent_64 = exponent + this.exponentExcess + 1024n;
				for (; mantissa_64 <= M && exponent_64 > 1n; mantissa_64 <<= 1n, --exponent_64);
				if (mantissa_64 <= M) { // subnormal in f64
					exponent_64 = 0n;
				} else { // normal in f64
					mantissa_64 &= M;
				}
			} else {
				exponent_64 = 0n;
			}
		} else {
			exponent_64 = exponent + this.exponentExcess + 1023n;
		}
		mantissa_64 <<= BigInt(52 - this.mantissaBits);
		this.buffer8[0] = sign << 63n | exponent_64 << 52n | mantissa_64;
		return new Float64Array(this.buffer8.buffer)[0];
	}

	setFloatInner(/** @type {number} */ value) {
		new Float64Array(this.buffer8.buffer)[0] = value;
		const
			sign = this.buffer8[0] >> 63n & 1n,
			exponent_64 = (this.buffer8[0] >> 52n & 0x7ffn),
			mantissa_64 = this.buffer8[0] & 0x000fffffffffffffn;
		let
			exponent = exponent_64 - 1023n - this.exponentExcess,
			mantissa = mantissa_64,
			shift = BigInt(52 - this.mantissaBits);
		if (exponent >= (1n << BigInt(this.exponentBits)) - 1n) { // inf, nan
			if (exponent_64 < 2047n) { // inf
				mantissa = 0n;
			}
			exponent = (1n << BigInt(this.exponentBits)) - 1n;
		} else if (exponent <= 0) { // subnormal
			if (exponent_64) {
				mantissa |= 1n << 52n;
				shift += 1n - exponent;
			} else {
				shift -= exponent;
			}
			exponent = 0n;
		}
		if (shift > 0) {
			const exotic = !(mantissa & ((1n << (shift - 1n)) - 1n));
			mantissa >>= shift - 1n;
			mantissa = (mantissa + (exotic ? mantissa & mantissa >> 1n & 1n : 1n)) >> 1n;
		}
		if (mantissa >> BigInt(this.mantissaBits)) {
			++exponent;
			mantissa = 0n;
		}
		return this.composeSEM(sign, exponent, mantissa);
	}

	/* override */ setFloat(/** @type {number} */ value) {
		this.buffer8[0] = this.setFloatInner(value);
		this.buffer.set(new Uint8Array(this.buffer8.buffer, 0, this.buffer.length));
	}

	/* override */ regardsEqual(/** @type {number} */ newValue, /** @type {number} */ oldValue) {
		const
			newBits = this.setFloatInner(newValue),
			oldBits = this.setFloatInner(oldValue);
		return newBits === oldBits;
	}
}

// for cases when e > 11 or m > 52
export class LongSEMFloat extends SEMFloatBase {
	mantissaBuffer;

	constructor(/** @type {number} */ exponentBits, /** @type {number} */ mantissaBits, exponentExcess = 1n - (1n << BigInt(exponentBits - 1))) {
		if (exponentBits < 12 && mantissaBits < 3)
			console.warn(`LongSEMFloat: exponentBits=${exponentBits}, mantissaBits=${mantissaBits} are too small, using SEMFloat instead.`);
		super(exponentBits, mantissaBits, exponentExcess);
		this.mantissaBuffer = new Uint8Array(this.buffer.length);
	}

	/* override */ reduce(/** @type {string} */ s) {
		return s;
	}
}

export class FP16 extends SEMFloatBase {
	mantissaBuffer = new Uint16Array(1);

	constructor() {
		super(5, 10);
	}

	/* override */ getMantissa(/** @type {bigint} */ mantissa, subnormal = false) {
		this.mantissaBuffer[0] = 0x3c00 | Number(mantissa);
		return new Float16Array(this.mantissaBuffer.buffer)[0] - subnormal;
	}

	/* override */ getFloat() {
		return new Float16Array(this.buffer.buffer)[0];
	}

	/* override */ setFloat(/** @type {number} */ value) {
		new Float16Array(this.buffer.buffer)[0] = value;
	}

	/* override */ regardsEqual(/** @type {number} */ newValue, /** @type {number} */ oldValue) {
		new Float16Array(this.mantissaBuffer.buffer)[0] = newValue;
		const newBits = this.mantissaBuffer[0];
		new Float16Array(this.mantissaBuffer.buffer)[0] = oldValue;
		const oldBits = this.mantissaBuffer[0];
		return newBits === oldBits;
	}
}

export class FP32 extends SEMFloatBase {
	mantissaBuffer = new Uint32Array(1);

	constructor() {
		super(8, 23);
	}

	/* override */ getMantissa(/** @type {bigint} */ mantissa, subnormal = false) {
		this.mantissaBuffer[0] = 0x3f800000 | Number(mantissa);
		return new Float32Array(this.mantissaBuffer.buffer)[0] - subnormal;
	}

	/* override */ getFloat() {
		return new Float32Array(this.buffer.buffer)[0];
	}

	/* override */ setFloat(/** @type {number} */ value) {
		new Float32Array(this.buffer.buffer)[0] = value;
	}

	/* override */ regardsEqual(/** @type {number} */ newValue, /** @type {number} */ oldValue) {
		new Float32Array(this.mantissaBuffer.buffer)[0] = newValue;
		const newBits = this.mantissaBuffer[0];
		new Float32Array(this.mantissaBuffer.buffer)[0] = oldValue;
		const oldBits = this.mantissaBuffer[0];
		return newBits === oldBits;
	}
}

export class FP64 extends SEMFloatBase {
	mantissaBuffer = new BigUint64Array(1);

	constructor() {
		super(11, 52);
	}

	/* override */ getMantissa(/** @type {bigint} */ mantissa, subnormal = false) {
		this.mantissaBuffer[0] = 0x3ff0000000000000n | mantissa;
		return new Float64Array(this.mantissaBuffer.buffer)[0] - subnormal;
	}

	/* override */ getFloat() {
		return new Float64Array(this.buffer.buffer)[0];
	}

	/* override */ setFloat(/** @type {number} */ value) {
		new Float64Array(this.buffer.buffer)[0] = value;
	}

	/* override */ reduce(/** @type {string} */ s) {
		// fp64 does not need to reduce
		return s;
	}
}

export class TensorFloat32 extends SEMFloat {
	constructor() {
		super(8, 23);
		this.mantissaBits = 10;
	}

	/* override */ initGridRow2() {
		for (let i = 0; i < this.bits; i += 8)
			for (let j = 0; j < 8; ++j) {
				const index = i + j, td = document.createElement('td');
				td.textContent = '0';
				td.classList.add(index > 18 ? 'unused' : index > 8 ? 'fraction' : index ? 'exponent' : 'sign');
				this.dBits[index] = td;
			}
	}

	/* override */ composeSEM(/** @type {bigint} */ sign, /** @type {bigint} */ exponent, /** @type {bigint} */ mantissa) {
		return sign << 31n | exponent << 23n | mantissa << 13n;
	}

	/* override */ decomposeSEM(/** @type {bigint} */ binary) {
		return [binary >> 31n & 1n, binary >> 23n & 255n, binary >> 13n & 1023n];
	}

	/* override */ getMantissa(/** @type {bigint} */ mantissa, subnormal = false) {
		this.buffer8[0] = 0x3ff0000000000000n | mantissa >> 13n << 42n;
		return new Float64Array(this.buffer8.buffer)[0] - subnormal;
	}
}

export class MBFFloat extends SEMFloat {
	constructor(/** @type {number} */ exponentBits, /** @type {number} */ mantissaBits, /** @type {number} */ exponentExcess) {
		super(exponentBits, mantissaBits, exponentExcess);
	}

	/* override */ initGridRow2() {
		for (let i = 0; i < this.bits; i += 8)
			for (let j = 0; j < 8; ++j) {
				const index = i + j, td = document.createElement('td');
				td.textContent = '0';
				td.classList.add(index > this.exponentBits ? 'fraction' : index === this.exponentBits ? 'sign' : 'exponent');
				this.dBits[index] = td;
			}
	}

	/* override */ composeSEM(/** @type {bigint} */ sign, /** @type {bigint} */ exponent, /** @type {bigint} */ mantissa) {
		return sign << BigInt(this.mantissaBits) | exponent << BigInt(this.mantissaBits + 1) | mantissa;
	}

	/* override */ decomposeSEM(/** @type {bigint} */ binary) {
		return [
			binary >> BigInt(this.mantissaBits) & 1n,
			(binary >> BigInt(this.mantissaBits + 1) & ((1n << BigInt(this.exponentBits)) - 1n)),
			binary & ((1n << BigInt(this.mantissaBits)) - 1n),
		];
	}

	/* override */ getFloat() {
		new Uint8Array(this.buffer8.buffer).set(this.buffer);
		const
			[sign, exponent, mantissa] = this.decomposeSEM(this.buffer8[0]),
			exponent_64 = exponent || mantissa ? exponent + this.exponentExcess + 1023n : 0n,
			mantissa_64 = mantissa << BigInt(52 - this.mantissaBits);
		this.buffer8[0] = sign << 63n | exponent_64 << 52n | mantissa_64;
		return new Float64Array(this.buffer8.buffer)[0];
	}

	setFloatInner(/** @type {number} */ value) {
		new Float64Array(this.buffer8.buffer)[0] = value;
		const
			sign = this.buffer8[0] >> 63n & 1n,
			exponent_64 = (this.buffer8[0] >> 52n & 0x7ffn),
			mantissa_64 = this.buffer8[0] & 0x000fffffffffffffn;
		let
			exponent = exponent_64 - 1023n - this.exponentExcess,
			mantissa = mantissa_64,
			shift = BigInt(52 - this.mantissaBits);
		if (exponent < 0) {
			exponent = 0n;
			mantissa = 0n;
		}
		if (shift > 0) {
			const exotic = !(mantissa & ((1n << (shift - 1n)) - 1n));
			mantissa >>= shift - 1n;
			mantissa = (mantissa + (exotic ? mantissa & mantissa >> 1n & 1n : 1n)) >> 1n;
		}
		if (mantissa >> BigInt(this.mantissaBits)) {
			++exponent;
			mantissa = 0n;
		}
		if (exponent >> BigInt(this.exponentBits)) {
			exponent = (1n << BigInt(this.exponentBits)) - 1n;
			mantissa = (1n << BigInt(this.mantissaBits)) - 1n;
		}
		return this.composeSEM(sign, exponent, mantissa);
	}

	/* override */ renderHelp() {
		new Uint8Array(this.buffer8.buffer).set(this.buffer);
		const [sign, exponent, mantissa] = this.decomposeSEM(this.buffer8[0]);

		this.sSign.textContent = sign ? '-1' : '+1';
		this.iExponent.textContent = exponent + this.exponentExcess;
		this.sFraction.textContent = exponent || mantissa ? this.reduce(this.getMantissa(mantissa, false).toString()) : '0';
	}

	/* override */ setFromString(/** @type {string} */ s) {
		const value = Number(s);
		if (Number.isFinite(value)) {
			this.setFloat(value);
		}
	}
}

export class X86Ext extends LongSEMFloat {
	constructor() {
		super(15, 64);
		this.mantissaBits = 63;
	}

	/* override */ initGridRow2() {
		for (let i = 0; i < this.bits; i += 8)
			for (let j = 0; j < 8; ++j) {
				const index = i + j, td = document.createElement('td');
				td.textContent = '0';
				td.classList.add(index > 16 ? 'fraction' : index === 16 ? 'x86-flag' : index ? 'exponent' : 'sign');
				this.dBits[index] = td;
			}
	}

	/* override */ decomposeSEM(/** @type {bigint} */ binary) {
		return [binary >> 79n & 1n, binary >> 64n & 32767n, binary & 0x7fff_ffff_ffff_ffffn];
	}

	/* override */ getMantissaString(/** @type {Uint8Array} */ buffer, subnormal = false) {
		// TODO: precisions beyond fp64
		return 'TODO';
	}

	/* override */ getFloatString() {
		// TODO: precisions beyond fp64
		return 'TODO';
	}

	/* override */ setFromString(/** @type {string} */ s) {
		// TODO: precisions beyond fp64
		this.buffer.fill(0xcc);
	}
}

export class FP128 extends LongSEMFloat {
	constructor() {
		super(15, 112);
	}

	/* override */ getMantissaString(/** @type {Uint8Array} */ buffer, subnormal = false) {
		// TODO: precisions beyond fp64
		return 'TODO';
	}

	/* override */ getFloatString() {
		// TODO: precisions beyond fp64
		return 'TODO';
	}

	/* override */ setFromString(/** @type {string} */ s) {
		// TODO: precisions beyond fp64
		this.buffer.fill(0xcc);
	}
}

export class FP256 extends LongSEMFloat {
	constructor() {
		super(19, 236);
	}

	/* override */ getMantissaString(/** @type {Uint8Array} */ buffer, subnormal = false) {
		// TODO: precisions beyond fp64
		return 'TODO';
	}

	/* override */ getFloatString() {
		// TODO: precisions beyond fp64
		return 'TODO';
	}

	/* override */ setFromString(/** @type {string} */ s) {
		// TODO: precisions beyond fp64
		this.buffer.fill(0xcc);
	}
}
