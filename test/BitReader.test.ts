import BitReader from "../lib/BitReader"

describe('BitReader', () => {
	it('basic tests', () => {
		const data = Uint8Array.of(0b10000011, 0b00000110, 0b00001100, 0b00011000, 0b00110000, 0b01100000, 0b11000001)
		const reader = new BitReader(data)
		for (let i = 0; i < 8; i++) {
			expect(reader.offset).toBe(i * 7)
			expect(reader.length).toBe(data.length * 8)
			expect(reader.read(7)).toBe(0b1000001)
		}
		expect(reader.offset).toBe(data.length * 8)
		expect(reader.length).toBe(data.length * 8)
		expect(() => reader.read1()).toThrow('unexpected EOF')
	})

	it('ue(v)', () => {
		const cases: [number, number][] = [
			[1,    0b1    ],
			[3,   0b010   ],
			[3,   0b011   ],
			[5,  0b00100  ],
			[5,  0b00101  ],
			[5,  0b00110  ],
			[5,  0b00111  ],
			[7, 0b0001000 ],
			[7, 0b0001001 ],
			[7, 0b0001010 ],
		]
		for (const [o, [n, ib]] of cases.entries()) {
			expect(n).toBeLessThanOrEqual(8)
			const data = Uint8Array.of(ib << (8 - n))
			expect(new BitReader(data).read(n)).toBe(ib)
			const reader = new BitReader(data)
			expect(reader.readExp()).toBe(o)
			expect(reader.offset).toBe(n)
		}
	})

	it('se(v) zig-zag encoding', () => {
		const reader = new BitReader(Uint8Array.of())
		for (const [i, o] of [0, 1, -1, 2, -2, 3, -3].entries()) {
			reader.readExp = () => i
			expect(reader.readSExp()).toBe(o)
		}
	})
})
