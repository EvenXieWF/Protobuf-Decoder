import { decodeProtobuf } from './protobufDecoder';

self.onmessage = (e: MessageEvent) => {
    const { hexData, protoSchema } = e.data;

    try {
        if (!hexData) {
            throw new Error("No hex data provided");
        }

        const result = decodeProtobuf(hexData, protoSchema);
        self.postMessage({ success: true, data: result });
    } catch (error) {
        self.postMessage({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown worker error'
        });
    }
};
