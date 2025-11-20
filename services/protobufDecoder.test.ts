import { describe, it, expect } from 'vitest';
import { decodeProtobuf } from './protobufDecoder';
import { WireType } from '../types';

describe('protobufDecoder', () => {
    it('should decode a simple varint (field 1, value 150)', () => {
        // 08 = field 1, wire type 0 (varint)
        // 96 01 = 150
        const hex = '089601';
        const result = decodeProtobuf(hex, '');

        expect(result.error).toBeUndefined();
        expect(result.fields).toHaveLength(1);
        expect(result.fields[0].fieldNumber).toBe(1);
        expect(result.fields[0].wireType).toBe(WireType.VARINT);
        const content = result.fields[0].content as any;
        expect(content.type).toBe('varint');
        expect(Number(content.asUint)).toBe(150);
    });

    it('should decode a string (field 2, value "testing")', () => {
        // 12 = field 2, wire type 2 (length delimited)
        // 07 = length 7
        // 74 65 73 74 69 6e 67 = "testing"
        const hex = '120774657374696e67';
        const result = decodeProtobuf(hex, '');

        expect(result.error).toBeUndefined();
        expect(result.fields).toHaveLength(1);
        expect(result.fields[0].fieldNumber).toBe(2);
        expect(result.fields[0].wireType).toBe(WireType.LENGTH_DELIMITED);
        expect(result.fields[0].content).toBe('testing');
    });

    it('should handle schema-based decoding', () => {
        const hex = '089601';
        const schema = `
      syntax = "proto3";
      message Test {
        int32 id = 1;
      }
    `;
        const result = decodeProtobuf(hex, schema);

        expect(result.error).toBeUndefined();
        expect(result.fields[0].fieldName).toBe('id');
        expect(result.fields[0].typeName).toBe('int32');
    });

    it('should throw error for invalid hex', () => {
        const hex = '08ZZ'; // Invalid hex
        expect(() => decodeProtobuf(hex, '')).toThrow('Invalid hex character');
    });

    it('should handle nested messages (schema-less)', () => {
        // Field 3 (1A), length 2 (02), content: Field 1 (08), value 5 (05) -> 1A 02 08 05
        const hex = '1A020805';
        const result = decodeProtobuf(hex, '');

        expect(result.fields).toHaveLength(1);
        const field = result.fields[0];
        expect(field.fieldNumber).toBe(3);
        expect(field.typeName).toBe('Embedded Message');

        const nestedFields = field.content as any[];
        expect(nestedFields).toHaveLength(1);
        expect(nestedFields[0].fieldNumber).toBe(1);
        expect(Number(nestedFields[0].content.asUint)).toBe(5);
    });
});
