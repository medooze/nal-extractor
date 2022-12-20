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
})
