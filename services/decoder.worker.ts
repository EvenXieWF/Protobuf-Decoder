import { decodeProtobuf } from './protobufDecoder';
import { decodedFieldsToJson } from './jsonConverter';

self.onmessage = (e: MessageEvent) => {
    // 'input' can be string (hex) or Uint8Array
    const { input, protoSchema } = e.data;

    try {
        if (!input) {
            throw new Error("No input data provided");
        }

        const result = decodeProtobuf(input, protoSchema);
        const json = result.fields.length > 0 ? decodedFieldsToJson(result.fields) : null;

        self.postMessage({ success: true, data: { ...result, json } });
    } catch (error) {
        self.postMessage({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown worker error'
        });
    }
};
