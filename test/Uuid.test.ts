import { describe, expect, it } from "vitest"
import { parseUuid } from "../lib/index.js"

describe('UUID', () => {
	it('parses correctly', () => {
		expect(parseUuid('db196df9-b5d5-459a-972b-4384796efe3b'))
			.toBe(0xdb196df9b5d5459a972b4384796efe3bn)
		expect(parseUuid('db196df9-b5d5-459a-972b-4384796efe3b'.toUpperCase()))
			.toBe(0xdb196df9b5d5459a972b4384796efe3bn)
	})

	it('fails on invalid format', () => {
		expect(() => parseUuid('wrong'))
			.toThrowError('invalid UUID: wrong')
	})
})
