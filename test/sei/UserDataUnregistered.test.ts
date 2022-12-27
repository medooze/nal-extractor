import { decodeRBSP, NALUType, parseNALU, parseSEI, parseUuid, SEIMessageType } from "../../lib"
import { parseUserDataUnregistered } from "../../lib/sei/UserDataUnregistered"

const x264optionsUuid = parseUuid('dc45e9bd-e6d9-48b7-962c-d820d923eeef')

describe('unregistered user data SEI', () => {
	it("decodes x264's unofficial 'options SEI'", () => {
		const rawData = 'BgX//7bcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY0IHIzMDk1IGJhZWU0MDAgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDIyIC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MSByZWY9MyBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgzOjB4MTEzIG1lPWhleCBzdWJtZT03IHBzeT0xIHBzeV9yZD0xLDAwOjAsMDAgbWl4ZWRfcmVmPTEgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0xIDh4OGRjdD0xIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9MTIgbG9va2FoZWFkX3RocmVhZHM9MiBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0wIHdlaWdodHA9MiBrZXlpbnQ9MzAwIGtleWludF9taW49MzAgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD00MCByYz1jYnIgbWJ0cmVlPTEgYml0cmF0ZT0yMDQ4IHJhdGV0b2w9MSwwIHFjb21wPTAsNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCB2YnZfbWF4cmF0ZT0yMDQ4IHZidl9idWZzaXplPTEyMjggbmFsX2hyZD1ub25lIGZpbGxlcj0wIGlwX3JhdGlvPTEsNDAgYXE9MToxLDAwAIA='
		// decode SEI NALU
		const nalu = parseNALU(Buffer.from(rawData, 'base64'))
		const sei = { ...nalu, rbsp: parseSEI(decodeRBSP(nalu.rbsp)) }
		// decode SEI message
		const seiPayload = sei.rbsp[0][1]
		expect(sei).toStrictEqual({
			forbidden_zero_bit: 0,
			nal_ref_idc: 0,
			nal_unit_type: NALUType.SEI,
			rbsp: [
				[ SEIMessageType.USER_DATA_UNREGISTERED, seiPayload ],
			],
		})
		const { uuid, data } = parseUserDataUnregistered(seiPayload)
		expect(uuid).toBe(x264optionsUuid)
		expect(new TextDecoder().decode(data)).toStrictEqual(
			'x264 - core 164 r3095 baee400 - H.264/MPEG-4 AVC codec - Copyleft 2003-2022 - http://www.videolan.org/x264.html - options: '
			+ 'cabac=1 ref=3 deblock=1:0:0 analyse=0x3:0x113 me=hex subme=7 psy=1 psy_rd=1,00:0,00 mixed_ref=1 me_range=16 chroma_me=1 trellis=1 8x8dct=1 cqm=0 deadzone=21,11 fast_pskip=1 chroma_qp_offset=-2 threads=12 lookahead_threads=2 sliced_threads=0 nr=0 decimate=1 interlaced=0 bluray_compat=0 constrained_intra=0 bframes=0 weightp=2 keyint=300 keyint_min=30 scenecut=40 intra_refresh=0 rc_lookahead=40 rc=cbr mbtree=1 bitrate=2048 ratetol=1,0 qcomp=0,60 qpmin=0 qpmax=69 qpstep=4 vbv_maxrate=2048 vbv_bufsize=1228 nal_hrd=none filler=0 ip_ratio=1,40 aq=1:1,00'
			+ '\0'
		)

		expect(() => parseUserDataUnregistered(seiPayload.subarray(0, 15))).toThrow()
	})
})
