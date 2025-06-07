import { FLOAT, SEMFloatBase } from './abc.mjs';
import { divTiesToEven, reduceFraction, shrTiesToEven } from './util.mjs';

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
		mantissa = shrTiesToEven(mantissa, shift);
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

	static string2Fraction(/** @type {string} */ s) {
		const parts = s.match(FLOAT);
		if (!parts) return null;

		let num, den = 0;
		const [, whole, fraction, exponent] = parts;

		if (fraction) {
			den = fraction.length - 1;
			num = BigInt(whole[0] === '+' || whole[0] === '-' ? whole.substring(1) : whole) *
				10n ** BigInt(den) + BigInt(fraction.substring(1));
			if (whole[0] === '-') num = -num;
		} else {
			try {
				num = BigInt(whole);
			} catch { return null; }
		}

		if (exponent) {
			let exp = Number(exponent.substring(1));
			if (exp > 80000) exp = 80000;
			else if (exp < -80000) exp = -80000;
			if (exp < 0) {
				den -= exp;
			} else {
				num *= 10n ** BigInt(exp);
			}
		}

		return reduceFraction(num, den);
	}

	static fraction2Proto(/** @type {bigint} */ num, /** @type {bigint} */ den, /** @type {number} */ mantissaBits, /** @type {number?} */ useStaticLog = null) {
		let lg = useStaticLog;
		if (lg === null) {
			lg = BigInt(Math.round((num.toString(16).length - den.toString(16).length) * Math.log10(16)));

			const check = (lg, num, den) => lg >= 0 ? den * 10n ** lg <= num : den <= num * 10n ** -lg;

			for (; check(lg, num, den); ++lg);
			for (; !check(lg, num, den); --lg);
		}

		if (lg >= 0) {
			den *= 10n ** lg;
		} else {
			num *= 10n ** -lg;
		}

		const enoughDigits = Math.ceil(mantissaBits / 3) + 1;
		return [(num * 10n ** BigInt(enoughDigits) / den).toString(), lg];
	}

	static fraction2EM(/** @type {bigint} */ num, /** @type {bigint} */ den, /** @type {number} */ mantissaBits) {
		// 2^exponent ≤ num/den < 2^(exponent + 1)
		let exponent = BigInt((num.toString(16).length - den.toString(16).length) * 4);

		const check = (exponent, num, den) => exponent >= 0 ? den << exponent <= num : den <= num << -exponent;

		for (; check(exponent, num, den); ++exponent);
		for (; !check(exponent, num, den); --exponent);

		if (exponent >= 0) {
			den <<= exponent;
		} else {
			num <<= -exponent;
		}
		num -= den;

		console.assert(0n <= num && num < den);
		num <<= BigInt(mantissaBits);

		let mantissa = divTiesToEven(num, den);
		if (mantissa >> BigInt(mantissaBits)) {
			++exponent;
			mantissa = 0n;
		}

		return [exponent, mantissa];
	}

	static EM2fraction(/** @type {bigint} */ exponent, /** @type {bigint} */ mantissa, /** @type {number} */ mantissaBits) {
		const t = exponent - BigInt(mantissaBits), m = 1n << BigInt(mantissaBits) | mantissa;
		return t >= 0 ? [m << t, 1n] : [m, 1n << -t];
	}

	static string2SEM(/** @type {string} */ s, /** @type {number} */ mantissaBits) {
		s = s.trim();
		switch (s.toUpperCase()) {
			case 'NAN': return [0n, null, 1n << BigInt(mantissaBits - 1)];
			case 'INF':
			case 'INFINITY':
			case '+INF':
			case '+INFINITY': return [0n, null, 0n];
			case '-INF':
			case '-INFINITY': return [1n, null, 0n];
		}

		const ret = LongSEMFloat.string2Fraction(s);
		if (ret === null) return null;

		const [num, den] = ret, isNegative = s.startsWith('-'), sign = BigInt(isNegative);
		if (!num) return [sign, -Infinity, 0n];

		console.assert(isNegative === (num < 0));
		return [sign, ...LongSEMFloat.fraction2EM(isNegative ? -num : num, den, mantissaBits)];
	}

	rawSEM2bits(/** @type {bigint} */ sign, /** @type {bigint} */ exponent, /** @type {bigint} */ mantissa) {
		if (exponent === -Infinity) { // zero
			return this.composeSEM(sign, 0n, mantissa);
		} else if (exponent == null) { // ±inf, NaN
			return this.composeSEM(sign, (1n << BigInt(this.exponentBits)) - 1n, mantissa);
		} else {
			let encodedExponent = exponent - this.exponentExcess;
			if (encodedExponent <= 0) { // subnormal
				mantissa |= 1n << BigInt(this.mantissaBits);
				mantissa = shrTiesToEven(mantissa, 1n - encodedExponent);
				encodedExponent = 0n;
			} else if (encodedExponent >= (1n << BigInt(this.exponentBits)) - 1n) { // inf
				encodedExponent = (1n << BigInt(this.exponentBits)) - 1n;
				mantissa = 0n;
			}
			return this.composeSEM(sign, encodedExponent, mantissa);
		}
	}

	__tryScientific(/** @type {string} */ mantissa, /** @type {bigint} */ power) {
		if (-6 <= power && power < 0) {
			return `0.${'0'.repeat(Number(~power))}${mantissa}`;
		} else if (0 <= power && power < 21) {
			let len = Number(power + 1n);
			return mantissa.length <= len ? mantissa.padEnd(len, '0') : `${mantissa.substring(0, len)}.${mantissa.substring(len)}`;
		} else
			return `${mantissa[0]}${mantissa.length > 1 ? '.' : ''}${mantissa.substring(1)}e${power >= 0 ? '+' : ''}${power}`;
	}

	#e(/** @type {string} */ prevString, /** @type {string} */ myString, /** @type {string} */ nextString, /** @type {bigint} */ num, /** @type {bigint} */ den, /** @type {bigint} */ lg) {
		lg += BigInt(nextString.length - myString.length);
		prevString = prevString.padStart(nextString.length, '0');
		myString = myString.padStart(nextString.length, '0');

		let ret;
		for (let i = 0; ; ++i) {
			if (prevString[i] === nextString[i]) {
				console.assert(prevString[i] === myString[i]);
			} else if (prevString.codePointAt(i) + 1 === nextString.codePointAt(i)) {
				ret = nextString.substring(0, i + 1);
				break;
			} else {
				// round(10^(i-lg) num/den)
				let lgi = lg - BigInt(i);
				ret = (lgi >= 0 ? divTiesToEven(num, den * 10n ** lgi) : divTiesToEven(num * 10n ** -lgi, den)).toString().padStart(i + 1, '0');
				break;
			}
		}

		for (; ret[0] === '0'; ret = ret.substring(1), --lg);
		return this.__tryScientific(ret, lg);
	}

	/* override */ getMantissaString(/** @type {bigint} */ mantissa, subnormal = false) {
		if (!mantissa) return subnormal ? '0' : '1';
		const den = 1n << BigInt(this.mantissaBits), num = subnormal ? mantissa : mantissa + den;
		let
			[myString, lg] = LongSEMFloat.fraction2Proto(num, den, this.mantissaBits),
			[nextString] = LongSEMFloat.fraction2Proto(num << 1n | 1n, den << 1n, this.mantissaBits, lg),
			[prevString] = LongSEMFloat.fraction2Proto((num << 1n) - 1n, den << 1n, this.mantissaBits, lg);
		lg += BigInt(nextString.length - myString.length);
		prevString = prevString.padStart(nextString.length, '0');
		myString = myString.padStart(nextString.length, '0');
		return this.#e(prevString, myString, nextString, num, den, lg);
	}

	/* override */ getFloatString() {
		const [sign, exponent, mantissa] = this.decomposeSEM(BigInt('0x' + this.buffer.toReversed().toHex()));

		if ((exponent + 1n) >> BigInt(this.exponentBits)) // ±inf, NaN
			return (mantissa ? NaN : sign ? -Infinity : Infinity).toString();

		let num, den;
		let num_next, den_next;
		let num_prev, den_prev;
		if (exponent) {
			[num, den] = LongSEMFloat.EM2fraction(exponent + this.exponentExcess, mantissa, this.mantissaBits);
			[num_next, den_next] = LongSEMFloat.EM2fraction(exponent + this.exponentExcess, mantissa << 1n | 1n, this.mantissaBits + 1);
			[num_prev, den_prev] = mantissa ?
				LongSEMFloat.EM2fraction(exponent + this.exponentExcess, (mantissa << 1n) - 1n, this.mantissaBits + 1) :
				LongSEMFloat.EM2fraction(exponent + this.exponentExcess - 1n, (1n << BigInt(this.mantissaBits + 1)) - 1n, this.mantissaBits + 1);
		} else { // subnormal
			if (!mantissa) return sign ? '-0' : '0';
			num = mantissa;
			den = 1n << (BigInt(this.mantissaBits) - this.exponentExcess - 1n);
			num_next = mantissa << 1n | 1n;
			den_next = den << 1n;
			num_prev = (mantissa << 1n) - 1n;
			den_prev = den << 1n;
		}

		let
			[myString, lg] = LongSEMFloat.fraction2Proto(num, den, this.mantissaBits),
			[nextString] = LongSEMFloat.fraction2Proto(num_next, den_next, this.mantissaBits, lg),
			[prevString] = LongSEMFloat.fraction2Proto(num_prev, den_prev, this.mantissaBits, lg);
		return (sign ? '-' : '') + this.#e(prevString, myString, nextString, num, den, lg);
	}

	/* override */ setFromString(/** @type {string} */ s) {
		const ret = LongSEMFloat.string2SEM(s, this.mantissaBits);
		if (ret !== null) {
			const b = Uint8Array.fromHex(this.rawSEM2bits(...ret).toString(16).padStart(this.buffer.length * 2, '0'));
			this.buffer.set(b.reverse());
		}
	}

	floatIncrementDecrement(/** @type {boolean} */ decrement) {
		let [sign, exponent, mantissa] = this.decomposeSEM(BigInt('0x' + this.buffer.toReversed().toHex()));

		if ((exponent + 1n) >> BigInt(this.exponentBits)) // ±inf, NaN
			return;

		let num, den;
		if (exponent) {
			[num, den] = LongSEMFloat.EM2fraction(exponent + this.exponentExcess, mantissa, this.mantissaBits);
		} else { // subnormal
			num = mantissa;
			den = 1n << (BigInt(this.mantissaBits) - this.exponentExcess - 1n);
		}

		if (!sign ^ decrement) num += den;
		else if (num >= den) num -= den;
		else num = den - num, sign ^= 1n;

		if (num) {
			[exponent, mantissa] = LongSEMFloat.fraction2EM(num, den, this.mantissaBits);
		} else {
			[sign, exponent, mantissa] = [0n, -Infinity, 0n];
		}
		const b = Uint8Array.fromHex(
			this.rawSEM2bits(sign, exponent, mantissa).toString(16).padStart(this.buffer.length * 2, '0')
		);
		this.buffer.set(b.reverse());
	}

	/* override */ floatIncrement() {
		this.floatIncrementDecrement(false);
	}

	/* override */ floatDecrement() {
		this.floatIncrementDecrement(true);
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
		if (exponent < 0) { // no subnormal!
			exponent = 0n;
			mantissa = 0n;
		}
		mantissa = shrTiesToEven(mantissa, shift);
		if (mantissa >> BigInt(this.mantissaBits)) {
			++exponent;
			mantissa = 0n;
		}
		if (exponent >> BigInt(this.exponentBits)) { // no inf!
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
		this.sFraction.textContent = exponent || mantissa ? this.getMantissaString(mantissa, false) : '0';
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

	/* override */ __tryScientific(/** @type {string} */ mantissa, /** @type {bigint} */ power) {
		if (-6 <= power && power < 0) {
			return `0.${'0'.repeat(Number(~power))}${mantissa}`;
		} else if (0 <= power && power < 19) {
			let len = Number(power + 1n);
			return mantissa.length <= len ? mantissa.padEnd(len, '0') : `${mantissa.substring(0, len)}.${mantissa.substring(len)}`;
		} else
			return `${mantissa[0]}${mantissa.length > 1 ? '.' : ''}${mantissa.substring(1)}e${power >= 0 ? '+' : ''}${power}`;
	}

	/* override */ composeSEM(/** @type {bigint} */ sign, /** @type {bigint} */ exponent, /** @type {bigint} */ mantissa) {
		return sign << 79n | exponent << 64n | BigInt(!!exponent) << 63n | mantissa;
	}

	/* override */ decomposeSEM(/** @type {bigint} */ binary) {
		return [binary >> 79n & 1n, binary >> 64n & 32767n, binary & 0x7fff_ffff_ffff_ffffn];
	}
}
