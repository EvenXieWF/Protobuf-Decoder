
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
  rawBytes: Uint8Array;
  payloadStartOffset?: number; // Absolute byte offset for the start of the payload
}

// FIX: Added `(number | bigint)[]` to the Content type union to correctly type packed repeated fields.
export type Content =
  | string
  | DecodedField[]
  | (number | bigint)[]
  | VarintContent
  | Fixed32Content
  | Fixed64Content;

export interface VarintContent {
  type: 'varint';
  asUint: bigint;
  asSint: bigint;
  enumValue?: string; // Added for Enum support
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
export interface EnumDef {
  name: string;
  values: Map<number, string>;
}

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
  enums: Map<string, EnumDef>; // Nested enums
}

export interface ParsedSchema {
  messages: Map<string, MessageDef>;
  enums: Map<string, EnumDef>; // Top-level enums
  rootMessage: string | null;
}

export type InputFormat = 'hex' | 'base64' | 'decimal';