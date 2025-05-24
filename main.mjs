import { FP128, FP16, FP256, FP32, FP64, MBFFloat, SEMFloat, TensorFloat32, X86Ext } from './render.mjs';
import { DOMContentLoaded, polyfill } from './util.mjs';

Promise.all([DOMContentLoaded, polyfill]).then(main);

async function main() {
	document.body.append(
		new SEMFloat(4, 3).load({
			key: '8',
			name: '8-bit (E4M3)',
			ref: 'https://en.wikipedia.org/wiki/Minifloat#8-bit_(1.4.3)',
		}),
		new SEMFloat(5, 2).load({
			key: 'e5m2',
			name: '8-bit (E5M2)',
			ref: 'https://docs.nvidia.com/cuda/cuda-math-api/cuda_math_api/struct____nv__fp8__e5m2.html',
		}),
		new SEMFloat(3, 4).load({
			key: 'e3m4',
			name: '8-bit (E3M4)',
			ref: 'https://en.wikipedia.org/wiki/Minifloat#8-bit_(1.3.4)',
		}),
		new FP16().load({
			key: '16',
			name: '16-bit (half)',
			ref: 'https://en.wikipedia.org/wiki/Half-precision_floating-point_format',
		}),
		new SEMFloat(8, 7).load({
			key: 'bf16',
			name: '16-bit (bfloat16)',
			ref: 'https://en.wikipedia.org/wiki/Bfloat16_floating-point_format',
		}),
		new SEMFloat(7, 16).load({
			key: '24',
			name: 'AMD\'s fp24',
			ref: 'https://en.wikipedia.org/wiki/Bfloat16_floating-point_format#bfloat16_floating-point_format',
		}),
		new SEMFloat(8, 15).load({
			key: 'pxr24',
			name: 'Pixar\'s PXR24',
			ref: 'https://en.wikipedia.org/wiki/Bfloat16_floating-point_format#bfloat16_floating-point_format',
		}),
		new FP32().load({
			key: '32',
			name: '32-bit (float)',
			ref: 'https://en.wikipedia.org/wiki/Single-precision_floating-point_format',
		}),
		new TensorFloat32().load({
			key: 'tf32',
			name: 'TensorFloat-32',
			ref: 'https://en.wikipedia.org/wiki/TensorFloat-32',
		}),
		new MBFFloat(8, 23, -129n).load({
			key: 'mbf32',
			name: 'Microsoft Binary Format (32-bit)',
			ref: 'https://en.wikipedia.org/wiki/Microsoft_Binary_Format#Technical_details',
		}),
		new MBFFloat(8, 31, -129n).load({
			key: 'mbf40',
			name: 'Microsoft Binary Format (40-bit)',
			ref: 'https://en.wikipedia.org/wiki/Microsoft_Binary_Format#Technical_details',
		}),
		new FP64().load({
			key: '64',
			name: '64-bit (double)',
			ref: 'https://en.wikipedia.org/wiki/Double-precision_floating-point_format',
		}),
		// new MBF64().load({
		// 	key: 'mbf64',
		// 	name: 'Microsoft Binary Format (64-bit)',
		// 	ref: 'https://en.wikipedia.org/wiki/Microsoft_Binary_Format#Technical_details',
		// }),
		new X86Ext().load({
			key: 'x86ext',
			name: '80-bit (x86/x87 extended)',
			ref: 'https://en.wikipedia.org/wiki/Extended_precision',
		}),
		new FP128().load({
			key: '128',
			name: '128-bit (quadruple)',
			ref: 'https://en.wikipedia.org/wiki/Quadruple-precision_floating-point_format',
		}),
		new FP256().load({
			key: '256',
			name: '256-bit (octuple)',
			ref: 'https://en.wikipedia.org/wiki/Octuple-precision_floating-point_format',
		}),
	);
}
