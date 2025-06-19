/** @typedef {{ key: string, name: string, ref: string, init?: string }} LoadArgs */

export const
	PI = '3.141592653589793238462643383279502884197169399375105820974944592307816406286208998628034825342117067982148086513282306647093844609550582231725359408128481117450284102701938521105559644622948954930381964428810975665933446128475648233786783165271201909145649',
	FLOAT = /^([+-]?\d*)((?:\.\d*)?)((?:[eE][+-]?\d+)?)$/;

export /* abstract */ class FloatToyBase {
	/** @type {DocumentFragment} */ static templateCached = null;
	bits;
	/** @type {string} */ key;
	buffer;
	#lastRendered;
	/** @type {HTMLSpanElement} */ input;
	/** @type {HTMLInputElement} */ output;
	/** @type {HTMLSpanElement} */ help;
	/** @type {HTMLInputElement} */ hex;
	/** @type {HTMLTableCellElement[]} */ dBits = [];
	mouseDownValue = -1;

	constructor(/** @type {number} */ bits) {
		if (new.target === FloatToyBase)
			throw new TypeError(`Cannot construct ${new.target.name} instances directly`);
		if (bits & 7)
			throw new RangeError(`Invalid bits parameter: ${bits}. Must be a multiple of 8.`);
		this.bits = bits;
		this.buffer = new Uint8Array(bits / 8);
		this.#lastRendered = new Uint8Array(bits / 8);
	}

	static template() {
		if (!FloatToyBase.templateCached) {
			const
				fragment = document.createDocumentFragment(),
				a = document.createElement('a'),
				h2 = document.createElement('h2'),
				table1 = document.createElement('table'),
				table2 = document.createElement('table'),
				tr1 = document.createElement('tr'),
				tr2 = document.createElement('tr'),
				td1 = document.createElement('td'),
				td2 = document.createElement('td'),
				td3 = document.createElement('td'),
				td4 = document.createElement('td'),
				td5 = document.createElement('td'),
				td6 = document.createElement('td'),
				span1 = document.createElement('span'),
				span2 = document.createElement('span'),
				span3 = document.createElement('span'),
				input1 = document.createElement('input'),
				input2 = document.createElement('input');
			h2.appendChild(a);
			span1.classList.add('input');
			td1.appendChild(span1);
			span2.textContent = '\xa0\xa0=\xa0\xa00x';
			span2.classList.add('zerox');
			td2.appendChild(span2);
			td2.classList.add('zerox-col');
			input1.classList.add('output');
			td3.appendChild(input1);
			td3.classList.add('hex-col');
			tr1.append(td1, td2, td3);
			table1.appendChild(tr1);
			span3.classList.add('help');
			td4.appendChild(span3);
			td5.textContent = '\xa0\xa0=\xa0\xa0';
			input2.value = '0';
			input2.classList.add('output');
			td6.appendChild(input2);
			td6.classList.add('output-col');
			tr2.append(td4, td5, td6);
			table2.appendChild(tr2);
			fragment.append(h2, table1, table2);
			FloatToyBase.templateCached = fragment;
		}
		return FloatToyBase.templateCached.cloneNode(true);
	}

	initGrids() {
		const
			table = document.createElement('table'),
			tr1 = document.createElement('tr'),
			tr2 = document.createElement('tr');
		for (let i = 0; i < this.bits; i += 8)
			for (let j = 0; j < 8; ++j) {
				const
					index = this.bits - i - j - 1, // https://github.com/DarjanKrijan/float-toy/commit/03ba193d6db9fe7b3cb39647d4594ca7ea72d38c#diff-0eb547304658805aad788d320f10bf1f292797b5e6d745a3bf617584da017051L245
					td = document.createElement('td');
				td.textContent = index;
				td.classList.add('nibble');
				if (j < 4) td.classList.add('dark');
				tr1.appendChild(td);
			}
		this.initGridRow2(tr2);
		tr2.append(...this.dBits);
		table.append(tr1, tr2);
		this.input.appendChild(table);
	}

	/* abstract */ initGridRow2() {
		throw new Error('initGridRow2() must be implemented in subclasses');
	}

	/* abstract */ initHelp() {
		throw new Error('initHelp() must be implemented in subclasses');
	}

	/* abstract */ renderHelp() {
		throw new Error('renderHelp() must be implemented in subclasses');
	}

	/* abstract */ getFloatString() {
		throw new Error('getFloatString() must be implemented in subclasses');
	}

	/* abstract */ setFromString(/** @type {string} */ s) {
		throw new Error('setFromString() must be implemented in subclasses');
	}

	increment() {
		for (let i = 0; i < this.buffer.length && !(++this.buffer[i] & 255); ++i);
	}

	decrement() {
		for (let i = 0; i < this.buffer.length && !this.buffer[i]--; ++i);
	}

	/* abstract */ floatIncrement() {
		throw new Error('floatIncrement() must be implemented in subclasses');
	}

	/* abstract */ floatDecrement() {
		throw new Error('floatDecrement() must be implemented in subclasses');
	}

	render(updateOutput = true, updateHex = true) {
		if (this.#lastRendered.every((x, i) => x === this.buffer[i])) return false;

		for (let i = 0, p = this.buffer.length - 1; i < this.bits; i += 8, --p)
			for (let j = 0; j < 8; ++j)
				this.dBits[i + j].textContent = this.buffer[p] >> (7 - j) & 1;

		this.renderHelp();

		if (updateOutput) {
			this.output.value = this.getFloatString();
		}

		const hex = this.buffer.toReversed().toHex();
		if (updateHex) {
			this.hex.value = hex;
		}

		localStorage.setItem(`float-toy-${this.key}`, hex);
		this.#lastRendered.set(this.buffer);
		return true;
	}

	#__load_initFromHex(/** @type {string} */ s) {
		let b;
		try {
			b = Uint8Array.fromHex(s);
		} catch {
			return false;
		}
		return b.length === this.buffer.length && (this.buffer.set(b.reverse()), true);
	}

	load(/** @type {LoadArgs} */ loadArgs) {
		const
			template = FloatToyBase.template(),
			a = template.querySelector('a');
		a.href = loadArgs.ref;
		a.textContent = loadArgs.name;
		this.key = loadArgs.key;
		this.input = template.querySelector('span.input');
		this.output = template.querySelector('.output-col>input.output');
		this.help = template.querySelector('span.help');
		this.hex = template.querySelector('.hex-col>input.output');
		if (this.bits > 64)
			this.hex.style.minWidth = `${3.125 * this.bits}px`;
		this.initGrids();
		this.initHelp();

		this.output.addEventListener('keydown', e => {
			switch (e.code) {
				case 'Enter': {
					e.preventDefault();
					this.output.blur();
					break;
				}
				case 'ArrowUp': {
					e.preventDefault();
					this.floatIncrement();
					this.render();
					this.output.select();
					break;
				}
				case 'ArrowDown': {
					e.preventDefault();
					this.floatDecrement();
					this.render();
					this.output.select();
					break;
				}
			}
		});
		this.output.addEventListener('input', () => {
			this.setFromString(this.output.value);
			this.render(false, true);
		});
		this.output.addEventListener('blur', () => {
			if (!this.render())
				this.output.value = this.getFloatString();
		});

		this.hex.value = '0'.repeat(this.buffer.length * 2);
		this.hex.addEventListener('keydown', e => {
			switch (e.code) {
				case 'Enter': {
					e.preventDefault();
					this.hex.blur();
					break;
				}
				case 'ArrowUp': {
					e.preventDefault();
					this.increment();
					this.render();
					this.hex.select();
					break;
				}
				case 'ArrowDown': {
					e.preventDefault();
					this.decrement();
					this.render();
					this.hex.select();
					break;
				}
			}
		});
		this.hex.addEventListener('input', () => {
			if (!/^[0-9a-fA-F\s]*$/.test(this.hex.value)) return;
			const
				s = this.hex.value.replaceAll(/\s/g, '').slice(0, 2 * this.buffer.length),
				b = Uint8Array.fromHex(s.length & 1 ? s + '0' : s);
			this.buffer.fill(0);
			this.buffer.set(b.reverse(), this.buffer.length - b.length);
			this.render(true, false);
		});
		this.hex.addEventListener('blur', () => {
			if (!this.render())
				this.hex.value = this.buffer.toReversed().toHex();
		});

		this.input.addEventListener('mousedown', e => {
			const index = this.dBits.indexOf(e.target);
			if (index < 0) return;
			const
				byteIndex = this.buffer.length - (index >> 3) - 1,
				byteMask = 1 << (7 - (index & 7));
			this.buffer[byteIndex] ^= byteMask;
			this.mouseDownValue = this.buffer[byteIndex] & byteMask ? 1 : 0;
			this.render();
		});

		this.input.addEventListener('mousemove', e => {
			const index = this.dBits.indexOf(e.target);
			if (index < 0 || this.mouseDownValue < 0) return;
			const
				byteIndex = this.buffer.length - (index >> 3) - 1,
				byteMask = 1 << (7 - (index & 7));
			if (this.mouseDownValue)
				this.buffer[byteIndex] |= byteMask;
			else
				this.buffer[byteIndex] &= ~byteMask;
			this.render();
		});

		document.addEventListener('mouseup', () => this.mouseDownValue = -1);

		this.#__load_initFromHex(new URLSearchParams(location.search).get(this.key)) ||
			this.#__load_initFromHex(localStorage.getItem(`float-toy-${this.key}`)) ||
			this.setFromString(loadArgs.init ?? PI);
		this.render();
		return template;
	}
}

export /* abstract */ class SEMFloatBase extends FloatToyBase {
	exponentBits;
	mantissaBits;
	exponentExcess;
	/** @type {HTMLSpanElement} */ sSign;
	/** @type {HTMLSpanElement} */ sExponent;
	/** @type {HTMLSupElement} */ iExponent;
	/** @type {HTMLSpanElement} */ sFraction;

	constructor(/** @type {number} */ exponentBits, /** @type {number} */ mantissaBits, exponentExcess = 1n - (1n << BigInt(exponentBits - 1))) {
		if (new.target === SEMFloatBase)
			throw new TypeError(`Cannot construct ${new.target.name} instances directly`);
		super(exponentBits + mantissaBits + 1);
		this.exponentBits = exponentBits;
		this.mantissaBits = mantissaBits;
		this.exponentExcess = exponentExcess;
	}

	/* abstract */ getMantissa(/** @type {bigint} */ mantissa, subnormal = false) {
		throw new Error('getMantissa() must be implemented in subclasses');
	}

	/* abstract */ getFloat() {
		throw new Error('getFloat() must be implemented in subclasses');
	}

	/* abstract */ setFloat(/** @type {number} */ value) {
		throw new Error('setFloat() must be implemented in subclasses');
	}

	/* override */ initGridRow2() {
		for (let i = 0; i < this.bits; i += 8)
			for (let j = 0; j < 8; ++j) {
				const index = i + j, td = document.createElement('td');
				td.textContent = '0';
				td.classList.add(index > this.exponentBits ? 'fraction' : index ? 'exponent' : 'sign');
				this.dBits[index] = td;
			}
	}

	/* override */ initHelp() {
		this.sSign = document.createElement('span');
		this.sSign.classList.add('sign');
		this.iExponent = document.createElement('sup');
		this.sExponent = document.createElement('span');
		this.sExponent.classList.add('exponent');
		this.sExponent.append('2', this.iExponent);
		this.sFraction = document.createElement('span');
		this.sFraction.classList.add('fraction');
		this.help.append(this.sSign, '\xa0\xa0\xd7\xa0\xa0', this.sExponent, '\xa0\xa0\xd7\xa0\xa0', this.sFraction);
		this.renderHelp();
	}

	composeSEM(/** @type {bigint} */ sign, /** @type {bigint} */ exponent, /** @type {bigint} */ mantissa) {
		return sign << BigInt(this.bits - 1) | exponent << BigInt(this.mantissaBits) | mantissa;
	}

	decomposeSEM(/** @type {bigint} */ binary) {
		return [
			binary >> BigInt(this.bits - 1) & 1n,
			binary >> BigInt(this.mantissaBits) & ((1n << BigInt(this.exponentBits)) - 1n),
			binary & ((1n << BigInt(this.mantissaBits)) - 1n),
		];
	}

	regardsEqual(/** @type {number} */ newValue, /** @type {number} */ oldValue) {
		return newValue === oldValue;
	}

	reduce(/** @type {string} */ s) {
		const parts = s.match(FLOAT);
		if (!parts) return s;

		const oldValue = Number(s);
		let [, whole, fraction, exponent] = parts;

		// Remove digits one-by-one until the number changes
		for (; fraction.length > 1;) {
			// Try truncating
			fraction = fraction.slice(0, -1);

			const text0 = whole + (fraction === '.' ? '' : fraction) + exponent;
			let parity = false;

			let i = fraction.length - 1;
			if (i) {
				parity = !(Number(fraction[i]) & 1);
			} else {
				parity = !(BigInt(whole) & 1n);
			}
			for (; fraction[i] === '9'; --i);
			if (i) {
				fraction = fraction.slice(0, i) + (Number(fraction[i]) + 1).toString();
			} else { // integer
				fraction = '';
				whole = (BigInt(whole) + 1n).toString();
				if (whole === '10' && exponent) {
					whole = '1';
					exponent = (Number(exponent.substring(1)) + 1).toString();
					exponent = (exponent[0] === '-' ? 'e' : 'e+') + exponent;
				}
			}

			const
				text1 = whole + (fraction === '.' ? '' : fraction) + exponent,
				value0 = Number(text0),
				value1 = Number(text1),
				diff0 = oldValue - value0,
				diff1 = value1 - oldValue,
				[text, value] =
					(diff0 === diff1 ? // See https://tc39.es/ecma262/#_ref_1491.
						(parity ? [text0, value0] : [text1, value1]) :
						(diff0 < diff1 ? [text0, value0] : [text1, value1]));
			if (this.regardsEqual(value, oldValue)) {
				s = text;
				[, whole, fraction, exponent] = s.match(FLOAT);
			} else {
				break;
			}
		}

		return s;
	}

	/* override */ renderHelp() {
		const
			[sign, exponent, mantissa] = this.decomposeSEM(BigInt('0x' + this.buffer.toReversed().toHex())),
			isSubnormal = !exponent;

		this.sSign.textContent = sign ? '-1' : '+1';
		this.iExponent.textContent = exponent + BigInt(isSubnormal) + this.exponentExcess;
		this.sFraction.textContent = this.getMantissaString(mantissa, isSubnormal);
	}

	getMantissaString(/** @type {bigint} */ mantissa, subnormal = false) {
		return this.reduce(this.getMantissa(mantissa, subnormal).toString());
	}

	/* override */ getFloatString() {
		const float = this.getFloat();
		return Object.is(float, -0) ? '-0' : this.reduce(float.toString());
	}

	/* override */ setFromString(/** @type {string} */ s) {
		const value = SEMFloatBase.extractF64Number(s);
		if (value !== null) {
			this.setFloat(value);
		}
	}

	/* override */ floatIncrement() {
		this.setFloat(this.getFloat() + 1);
	}

	/* override */ floatDecrement() {
		this.setFloat(this.getFloat() - 1);
	}

	static extractF64Number(/** @type {string} */ s) {
		let value = Number(s = s.trim());
		if (!Number.isNaN(value)) return value;
		switch (s.toUpperCase()) {
			case 'NAN': return NaN;
			case 'INF':
			case 'INFINITY':
			case '+INF':
			case '+INFINITY': return Infinity;
			case '-INF':
			case '-INFINITY': return -Infinity;
		}
		return null;
	}
}
