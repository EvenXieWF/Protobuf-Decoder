
export enum WireType {
  VARINT = 0,
  FIXED64 = 1,
  LENGTH_DELIMITED = 2,
  FIXED32 = 5,
  UNKNOWN = -1,
}

export interface DecodedField {
  byteRange: [number, number];
  fieldNumber: number;
  fieldName?: string; // Name from .proto schema
  wireType: WireType;
  typeName: string;
  content: Content;
  rawBytesHex: string;
}

export type Content =
  | string
  | DecodedField[]
  | VarintContent
  | Fixed32Content
  | Fixed64Content;

export interface VarintContent {
  type: 'varint';
  asUint: bigint;
  asSint: bigint;
}

export interface Fixed32Content {
  type: 'fixed32';
  asFloat: number;
  asInt: number;
  asUint: number;
}

export interface Fixed64Content {
  type: 'fixed64';
  asDouble: number;
  asInt: bigint;
  asUint: bigint;
}

// Schema parsing types
export interface FieldDef {
  name: string;
  type: string;
  fieldNumber: number;
  isRepeated: boolean;
  isMap: boolean;
}
export interface MessageDef {
  name: string;
  fields: Map<number, FieldDef>;
}

export type ParsedSchema = Map<string, MessageDef>;
