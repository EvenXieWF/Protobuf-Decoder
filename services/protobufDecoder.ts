
import type { DecodedField, Content, VarintContent, Fixed32Content, Fixed64Content, ParsedSchema, MessageDef, FieldDef, EnumDef } from '../types';
import { WireType } from '../types';

// --- Helper Functions ---

const HEX_TABLE: string[] = [];
for (let i = 0; i < 256; i++) {
    HEX_TABLE[i] = (i + 0x100).toString(16).substr(1);
}

export function hexToBytes(hex: string): Uint8Array {
    const len = hex.length;
    if (len % 2 !== 0) {
        throw new Error("Hex string must have an even length");
    }
    const bytes = new Uint8Array(len / 2);
    for (let i = 0; i < len; i += 2) {
        const c1 = hex.charCodeAt(i);
        const c2 = hex.charCodeAt(i + 1);

        // Optimized parsing: 0-9 are 48-57, a-f are 97-102, A-F are 65-70
        let val1 = 0;
        if (c1 >= 48 && c1 <= 57) val1 = c1 - 48;
        else if (c1 >= 97 && c1 <= 102) val1 = c1 - 87;
        else if (c1 >= 65 && c1 <= 70) val1 = c1 - 55;
        else throw new Error("Invalid hex character");

        let val2 = 0;
        if (c2 >= 48 && c2 <= 57) val2 = c2 - 48;
        else if (c2 >= 97 && c2 <= 102) val2 = c2 - 87;
        else if (c2 >= 65 && c2 <= 70) val2 = c2 - 55;
        else throw new Error("Invalid hex character");

        bytes[i / 2] = (val1 << 4) | val2;
    }
    return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
    const len = bytes.length;
    const hexArr = new Array(len);
    for (let i = 0; i < len; i++) {
        hexArr[i] = HEX_TABLE[bytes[i]];
    }
    return hexArr.join(' ');
}

function zigzagDecode(n: bigint): bigint {
    return (n >> 1n) ^ -(n & 1n);
}

// --- Proto Schema Parser (Rewritten for Robustness) ---

function parseProto(protoStr: string): { schema: ParsedSchema; rootMessage: string | null } {
    const messages = new Map<string, MessageDef>();
    const enums = new Map<string, EnumDef>();
    let rootMessage: string | null = null;

    // 1. Clean the entire schema string first.
    let cleanProto = protoStr
        .replace(/\/\/.*$/gm, '')       // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

    // 2. Flatten all oneof blocks by removing their wrappers.
    cleanProto = cleanProto.replace(/oneof\s+\w+\s*\{([\s\S]*?)\}/g, '$1');

    // 3. Parse Top-Level Enums
    // Note: This simple regex might capture nested enums if we are not careful, 
    // but since we process messages separately, it's okay if we double-parse or we can be more specific.
    // For now, we assume top-level enums are outside message blocks or we parse everything and handle scoping during lookup.
    // Actually, to avoid confusion, let's parse messages first, and then enums? 
    // Or just parse all enums found in the string as global for now (simplification), 
    // but correct scoping requires knowing if it's inside a message.
    // Given the regex approach, strict scoping is hard. 
    // We will parse ALL enums found as "global" candidates, and also parse nested enums within messages.

    const enumRegex = /enum\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*?)\}/g;
    let enumMatch;
    while ((enumMatch = enumRegex.exec(cleanProto)) !== null) {
        const enumName = enumMatch[1];
        const enumBody = enumMatch[2];
        const values = new Map<number, string>();
        const valueRegex = /([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(-?\d+)\s*;/g;
        let valueMatch;
        while ((valueMatch = valueRegex.exec(enumBody)) !== null) {
            values.set(parseInt(valueMatch[2], 10), valueMatch[1]);
        }
        enums.set(enumName, { name: enumName, values });
    }

    // 4. Match all message blocks.
    const messageRegex = /message\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*?)\}/g;
    let messageMatch;
    while ((messageMatch = messageRegex.exec(cleanProto)) !== null) {
        const messageName = messageMatch[1];
        const messageBody = messageMatch[2];

        if (!rootMessage) {
            rootMessage = messageName;
        }

        const fields = new Map<number, FieldDef>();
        const nestedEnums = new Map<string, EnumDef>();

        // Parse nested enums
        let nestedEnumMatch;
        // We need a fresh regex or reset lastIndex. Using a new regex instance for safety.
        const nestedEnumRegex = /enum\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*?)\}/g;
        while ((nestedEnumMatch = nestedEnumRegex.exec(messageBody)) !== null) {
            const enumName = nestedEnumMatch[1];
            const enumBody = nestedEnumMatch[2];
            const values = new Map<number, string>();
            const valueRegex = /([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(-?\d+)\s*;/g;
            let valueMatch;
            while ((valueMatch = valueRegex.exec(enumBody)) !== null) {
                values.set(parseInt(valueMatch[2], 10), valueMatch[1]);
            }
            nestedEnums.set(enumName, { name: enumName, values });
        }

        // Parse fields
        const fieldRegex = /(?:(repeated)\s+)?(map<[\w\s,]+>|[\w.]+)\s+([\w_]+)\s*=\s*(\d+)\s*;/g;
        let fieldMatch;
        while ((fieldMatch = fieldRegex.exec(messageBody)) !== null) {
            const [_, isRepeated, type, name, fieldNumberStr] = fieldMatch;
            const fieldNumber = parseInt(fieldNumberStr, 10);
            const isMap = type.startsWith('map');

            fields.set(fieldNumber, {
                name,
                type,
                fieldNumber,
                isRepeated: !!isRepeated || isMap,
                isMap: isMap,
            });
        }

        if (messages.has(messageName) && fields.size > 0) {
            // Merge fields if a message is defined in parts (unlikely but possible)
            fields.forEach((value, key) => messages.get(messageName)!.fields.set(key, value));
            // Merge enums?
            nestedEnums.forEach((value, key) => messages.get(messageName)!.enums.set(key, value));
        } else {
            messages.set(messageName, { name: messageName, fields, enums: nestedEnums });
        }
    }

    if (messages.size === 0 && protoStr.trim().length > 0) {
        throw new Error("Could not find any 'message' definitions in the schema.");
    }

    return { schema: { messages, enums, rootMessage }, rootMessage };
}


// --- ProtoReader Class ---

class ProtoReader {
    private buffer: Uint8Array;
    private pos: number = 0;

    constructor(buffer: Uint8Array) {
        this.buffer = buffer;
    }

    get eof(): boolean {
        return this.pos >= this.buffer.length;
    }

    getPosition(): number {
        return this.pos;
    }

    getRemainingBuffer(): Uint8Array {
        return this.buffer.subarray(this.pos);
    }

    readVarint(): bigint {
        let result = 0n;
        let shift = 0n;
        const initialPos = this.pos;
        while (this.pos < this.buffer.length) {
            const byte = this.buffer[this.pos++];
            result |= (BigInt(byte) & 0x7Fn) << shift;
            if ((byte & 0x80) === 0) {
                return result;
            }
            shift += 7n;
            if (shift >= 64n) {
                throw new Error("Varint is too long or invalid.");
            }
        }
        this.pos = initialPos; // rewind on failure
        throw new Error(`Unterminated varint`);
    }

    readFixed32(): DataView {
        if (this.pos + 4 > this.buffer.length) throw new Error("Buffer underflow for fixed32");
        const slice = this.buffer.slice(this.pos, this.pos + 4);
        this.pos += 4;
        return new DataView(slice.buffer, slice.byteOffset, 4);
    }

    readFixed64(): DataView {
        if (this.pos + 8 > this.buffer.length) throw new Error("Buffer underflow for fixed64");
        const slice = this.buffer.slice(this.pos, this.pos + 8);
        this.pos += 8;
        return new DataView(slice.buffer, slice.byteOffset, 8);
    }

    readBytes(len: number): Uint8Array {
        if (this.pos + len > this.buffer.length) {
            throw new Error(`Buffer underflow trying to read ${len} bytes`);
        }
        const result = this.buffer.subarray(this.pos, this.pos + len);
        this.pos += len;
        return result;
    }
}

// --- Core Decoder Logic ---

const packablePrimitiveTypes = new Set([
    'int32', 'int64', 'uint32', 'uint64', 'sint32', 'sint64',
    'bool', 'enum',
    'fixed32', 'sfixed32', 'float',
    'fixed64', 'sfixed64', 'double'
]);

type DecodeResult = { fields: DecodedField[], error?: string, unparsedHex?: string, errorBytePos?: number };

function decode(buffer: Uint8Array, schema: ParsedSchema, currentMessageName: string | null, baseOffset = 0): DecodeResult {
    const reader = new ProtoReader(buffer);
    const fields: DecodedField[] = [];
    const messageDef = currentMessageName ? schema.messages.get(currentMessageName) : undefined;

    while (!reader.eof) {
        const fieldStartPosInLocalBuffer = reader.getPosition();
        try {
            const tag = reader.readVarint();
            const fieldNumber = Number(tag >> 3n);
            const wireType = Number(tag & 0x7n);
            const fieldDef = messageDef?.fields.get(fieldNumber);

            let content: Content;
            let typeName: string;
            let payloadStartOffset: number | undefined = undefined;

            switch (wireType) {
                case WireType.VARINT:
                    const varintValue = reader.readVarint();
                    let enumValue: string | undefined;

                    // Check if field type is an enum
                    if (fieldDef) {
                        // Check nested enums first
                        const nestedEnum = messageDef?.enums.get(fieldDef.type);
                        if (nestedEnum) {
                            enumValue = nestedEnum.values.get(Number(varintValue));
                        } else {
                            // Check global enums
                            const globalEnum = schema.enums.get(fieldDef.type);
                            if (globalEnum) {
                                enumValue = globalEnum.values.get(Number(varintValue));
                            }
                        }
                    }

                    content = { type: 'varint', asUint: varintValue, asSint: zigzagDecode(varintValue), enumValue } as VarintContent;
                    typeName = fieldDef?.type || "varint";
                    break;
                case WireType.FIXED64:
                    const f64View = reader.readFixed64();
                    content = {
                        type: 'fixed64',
                        asDouble: f64View.getFloat64(0, true),
                        asUint: f64View.getBigUint64(0, true),
                        asInt: f64View.getBigInt64(0, true),
                    } as Fixed64Content;
                    typeName = fieldDef?.type || "fixed64";
                    break;
                case WireType.LENGTH_DELIMITED:
                    const len = Number(reader.readVarint());
                    const payloadStartPosInLocalBuffer = reader.getPosition();
                    payloadStartOffset = payloadStartPosInLocalBuffer + baseOffset;
                    const bytes = reader.readBytes(len);

                    if (fieldDef && fieldDef.isRepeated && packablePrimitiveTypes.has(fieldDef.type)) {
                        // Packed repeated field
                        const packedReader = new ProtoReader(bytes);
                        const packedValues: (bigint | number)[] = [];
                        typeName = `repeated ${fieldDef.type}`;

                        while (!packedReader.eof) {
                            switch (fieldDef.type) {
                                case 'int32':
                                case 'int64':
                                case 'uint32':
                                case 'uint64':
                                case 'bool':
                                case 'enum':
                                    packedValues.push(packedReader.readVarint());
                                    break;
                                case 'sint32':
                                case 'sint64':
                                    packedValues.push(zigzagDecode(packedReader.readVarint()));
                                    break;
                                case 'fixed32':
                                    packedValues.push(packedReader.readFixed32().getUint32(0, true));
                                    break;
                                case 'sfixed32':
                                    packedValues.push(packedReader.readFixed32().getInt32(0, true));
                                    break;
                                case 'float':
                                    packedValues.push(packedReader.readFixed32().getFloat32(0, true));
                                    break;
                                case 'fixed64':
                                    packedValues.push(packedReader.readFixed64().getBigUint64(0, true));
                                    break;
                                case 'sfixed64':
                                    packedValues.push(packedReader.readFixed64().getBigInt64(0, true));
                                    break;
                                case 'double':
                                    packedValues.push(packedReader.readFixed64().getFloat64(0, true));
                                    break;
                            }
                        }
                        content = packedValues;

                    } else if (fieldDef && schema.messages.has(fieldDef.type)) {
                        // Nested Message
                        const subMessage = decode(bytes, schema, fieldDef.type, payloadStartOffset);
                        if (subMessage.error) { throw new Error(`Failed to decode sub-message of type ${fieldDef.type}`); }
                        content = subMessage.fields;
                        typeName = fieldDef.type;
                    } else if (fieldDef && (fieldDef.type === 'string' || fieldDef.type === 'bytes')) {
                        // String or Bytes
                        if (fieldDef.type === 'string') {
                            content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
                            typeName = "string";
                        } else {
                            content = bytesToHex(bytes);
                            typeName = "bytes";
                        }
                    } else { // Schema-less guessing
                        try {
                            const subMessage = decode(bytes, schema, null, payloadStartOffset);
                            if (subMessage.error || (bytes.length > 0 && subMessage.fields.length === 0)) {
                                throw new Error(); // Not a valid sub-message, fallback
                            }
                            content = subMessage.fields;
                            typeName = "Embedded Message";
                        } catch (e) {
                            try {
                                content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
                                typeName = "string (guessed)";
                            } catch (err) {
                                content = bytesToHex(bytes);
                                typeName = "bytes";
                            }
                        }
                    }
                    break;
                case WireType.FIXED32:
                    const f32View = reader.readFixed32();
                    content = {
                        type: 'fixed32',
                        asFloat: f32View.getFloat32(0, true),
                        asUint: f32View.getUint32(0, true),
                        asInt: f32View.getInt32(0, true),
                    } as Fixed32Content;
                    typeName = fieldDef?.type || "fixed32";
                    break;
                default:
                    throw new Error(`Unsupported wire type ${wireType}`);
            }

            const fieldEndPosInLocalBuffer = reader.getPosition();
            const rawBytes = buffer.subarray(fieldStartPosInLocalBuffer, fieldEndPosInLocalBuffer);

            fields.push({
                byteRange: [fieldStartPosInLocalBuffer + baseOffset, fieldEndPosInLocalBuffer - 1 + baseOffset],
                fieldNumber,
                fieldName: fieldDef?.name,
                wireType,
                typeName,
                content,
                rawBytes: rawBytes,
                payloadStartOffset,
            });
        } catch (e) {
            const errorPos = reader.getPosition();
            const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
            const unparsedHex = bytesToHex(reader.getRemainingBuffer());
            return { fields, error: `${errorMessage} at byte ${errorPos + baseOffset}.`, unparsedHex, errorBytePos: errorPos + baseOffset };
        }
    }
    return { fields };
}

export function decodeProtobuf(input: string | Uint8Array, protoSchema: string, baseOffset = 0): DecodeResult {
    let bytes: Uint8Array;
    if (typeof input === 'string') {
        bytes = hexToBytes(input);
    } else {
        bytes = input;
    }

    // Don't bother parsing an empty schema
    if (!protoSchema || !protoSchema.trim()) {
        return decode(bytes, { messages: new Map(), enums: new Map(), rootMessage: null }, null, baseOffset);
    }

    try {
        const { schema, rootMessage } = parseProto(protoSchema);
        const result = decode(bytes, schema, rootMessage, baseOffset);

        // Handle case where schema is valid but doesn't match the data, resulting in 0 fields decoded.
        // In this case, a schemaless attempt might be more useful.
        if (result.fields.length === 0 && bytes.length > 0 && !result.error) {
            const schemalessResult = decode(bytes, { messages: new Map(), enums: new Map(), rootMessage: null }, null, baseOffset);
            if (schemalessResult.fields.length > 0) {
                schemalessResult.error = "Warning: The provided schema was parsed successfully but did not match the data. The result below is from a schema-less decoding attempt.";
                return schemalessResult;
            }
        }
        return result;

    } catch (e) {
        const schemaErrorMessage = e instanceof Error ? e.message : "An unknown error occurred";
        const warning = `Schema parsing failed: "${schemaErrorMessage}".\nFalling back to schema-less decoding.`;

        // Perform the fallback decode
        const fallbackResult = decode(bytes, { messages: new Map(), enums: new Map(), rootMessage: null }, null, baseOffset);

        // Combine the warning with any errors from the fallback decode
        fallbackResult.error = fallbackResult.error
            ? `${warning}\n\nDecoding Error: ${fallbackResult.error}`
            : warning;

        return fallbackResult;
    }
}