# nal-extractor

JS library to parse H.264 NALUs, with a focus on SEI messages.
Also provides utilities to synchronize display of the extracted metadata.

As an optimization, these functions return subarrays of the input whenever
possible; keep that in mind if you save references to the parsed data.
