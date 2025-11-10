
import type { DecodedField, Content, VarintContent, Fixed32Content, Fixed64Content, ParsedSchema, MessageDef, FieldDef } from '../types';
import { WireType } from '../types';

// --- Helper Functions ---

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
}

function zigzagDecode(n: bigint): bigint {
  return (n >> 1n) ^ -(n & 1n);
}

// --- Proto Schema Parser ---

function parseProto(protoStr: string): { schema: ParsedSchema; rootMessage: string | null } {
    const schema: ParsedSchema = new Map();
    let rootMessage: string | null = null;

    // Naive cleaning
    let cleanProto = protoStr.replace(/\/\/.*$/gm, ''); // remove single line comments
    cleanProto = cleanProto.replace(/\/\*[\s\S]*?\*\//g, ''); // remove multi-line comments

    const messageRegex = /message\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*?)\}/g;
    let match;
    while((match = messageRegex.exec(cleanProto)) !== null) {
        const messageName = match[1];
        const messageBody = match[2];

        if (!rootMessage) rootMessage = messageName;

        const fields = new Map<number, FieldDef>();
        const fieldRegex = /(repeated)?\s*(map\s*<.+?>)?\s*([A-Za-z_][A-Za-z0-9_.]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(\d+);/g;
        let fieldMatch;
        while((fieldMatch = fieldRegex.exec(messageBody)) !== null) {
            const [_, isRepeated, isMap, type, name, fieldNumberStr] = fieldMatch;
            const fieldNumber = parseInt(fieldNumberStr, 10);
            fields.set(fieldNumber, {
                name,
                type: isMap ? isMap.trim() : type.trim(),
                fieldNumber,
                isRepeated: !!isRepeated,
                isMap: !!isMap,
            });
        }
        schema.set(messageName, { name: messageName, fields });
    }
    return { schema, rootMessage };
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

type DecodeResult = { fields: DecodedField[], error?: string, unparsedHex?: string };

function decode(buffer: Uint8Array, schema: ParsedSchema, currentMessageName: string | null): DecodeResult {
    const reader = new ProtoReader(buffer);
    const fields: DecodedField[] = [];
    const messageDef = currentMessageName ? schema.get(currentMessageName) : undefined;

    while(!reader.eof) {
        const startPos = reader.getPosition();
        try {
            const tag = reader.readVarint();
            const fieldNumber = Number(tag >> 3n);
            const wireType = Number(tag & 0x7n);
            const fieldDef = messageDef?.fields.get(fieldNumber);

            let content: Content;
            let typeName: string;

            switch (wireType) {
                case WireType.VARINT:
                    const varintValue = reader.readVarint();
                    content = { type: 'varint', asUint: varintValue, asSint: zigzagDecode(varintValue) } as VarintContent;
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
                    const bytes = reader.readBytes(len);

                    if (fieldDef && schema.has(fieldDef.type)) {
                        const subMessage = decode(bytes, schema, fieldDef.type);
                        if(subMessage.error) { throw new Error(`Failed to decode sub-message of type ${fieldDef.type}`); }
                        content = subMessage.fields;
                        typeName = fieldDef.type;
                    } else if (fieldDef && (fieldDef.type === 'string' || fieldDef.type === 'bytes')) {
                       if (fieldDef.type === 'string') {
                           content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
                           typeName = "string";
                       } else {
                           content = bytesToHex(bytes);
                           typeName = "bytes";
                       }
                    } else { // Schema-less guessing
                        try {
                            const subMessage = decode(bytes, schema, null);
                            if(subMessage.error || (bytes.length > 0 && subMessage.fields.length === 0)) {
                                throw new Error(); // Not a valid sub-message, fallback
                            }
                            content = subMessage.fields;
                            typeName = "Embedded Message";
                        } catch(e) {
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

            const endPos = reader.getPosition();
            const rawBytes = buffer.subarray(startPos, endPos);

            fields.push({
                byteRange: [startPos, endPos - 1],
                fieldNumber,
                fieldName: fieldDef?.name,
                wireType,
                typeName,
                content,
                rawBytesHex: bytesToHex(rawBytes),
            });
        } catch (e) {
            const errorPos = reader.getPosition();
            const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
            const unparsedHex = bytesToHex(reader.getRemainingBuffer());
            return { fields, error: `${errorMessage} at byte ${errorPos}.`, unparsedHex };
        }
    }
    return { fields };
}

export function decodeProtobuf(hexString: string, protoSchema: string): DecodeResult {
    const bytes = hexToBytes(hexString);
    try {
        const { schema, rootMessage } = parseProto(protoSchema);
        return decode(bytes, schema, rootMessage);
    } catch (e) {
        // Fallback to schema-less if parser fails, or just decode schemaless
        return decode(bytes, new Map(), null);
    }
}
