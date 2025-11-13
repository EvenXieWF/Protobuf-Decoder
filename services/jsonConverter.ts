import type { DecodedField, Content, VarintContent, Fixed32Content, Fixed64Content } from '../types';

/**
 * Converts a primitive-like Content type from the decoder into a JSON-friendly value.
 * @param content The decoded content of a field.
 * @returns A JavaScript primitive, object, or array.
 */
const getPrimitiveValue = (content: Content, typeName: string): any => {
    if (typeof content === 'string') {
        // If schema says it's a string, return as is.
        if (typeName === 'string' || typeName === 'string (guessed)') {
            return content;
        }
        // For 'bytes' or potential embedded messages that weren't decoded,
        // wrap the hex string in an object to mark it as decodable in the UI.
        return { "__hex__": content };
    }
    
    if (Array.isArray(content)) {
        // Check if it's an array of nested messages (DecodedField objects)
        if (content.length > 0 && typeof content[0] === 'object' && content[0] !== null && 'fieldNumber' in content[0]) {
            return decodedFieldsToJson(content as DecodedField[]);
        }
        
        // Otherwise, it's a packed repeated field (array of primitives like numbers or bigints)
        return content.map(item => {
            if (typeof item === 'bigint') {
                return item <= BigInt(Number.MAX_SAFE_INTEGER) && item >= BigInt(Number.MIN_SAFE_INTEGER)
                    ? Number(item)
                    : item.toString();
            }
            return item;
        });
    }
    
    if (typeof content === 'object' && content !== null) {
        switch (content.type) {
            case 'varint':
                const v = content as VarintContent;
                // Prefer signed int if the type name suggests it
                if (typeName && typeName.toLowerCase().startsWith('sint')) {
                     return v.asSint <= BigInt(Number.MAX_SAFE_INTEGER) && v.asSint >= BigInt(Number.MIN_SAFE_INTEGER)
                        ? Number(v.asSint)
                        : v.asSint.toString();
                }
                // Default to unsigned int, using string for big integers
                return v.asUint <= BigInt(Number.MAX_SAFE_INTEGER)
                    ? Number(v.asUint)
                    : v.asUint.toString();

            case 'fixed32':
                const f32 = content as Fixed32Content;
                if(typeName && typeName.toLowerCase() === 'float') return f32.asFloat;
                if(typeName && typeName.toLowerCase().startsWith('sfixed')) return f32.asInt;
                return f32.asUint; // Default to uint

            case 'fixed64':
                 const f64 = content as Fixed64Content;
                 if (typeName && typeName.toLowerCase() === 'double') return f64.asDouble;
                 if (typeName && typeName.toLowerCase().startsWith('sfixed')) {
                    return f64.asInt <= BigInt(Number.MAX_SAFE_INTEGER) && f64.asInt >= BigInt(Number.MIN_SAFE_INTEGER)
                        ? Number(f64.asInt)
                        : f64.asInt.toString();
                 }
                // Default to uint, using string for big integers
                return f64.asUint <= BigInt(Number.MAX_SAFE_INTEGER)
                    ? Number(f64.asUint)
                    : f64.asUint.toString();
        }
    }
    return content;
};

/**
 * Converts an array of decoded fields into a nested JavaScript object.
 * Handles repeated fields by turning them into arrays.
 * @param fields The array of decoded Protobuf fields.
 * @returns A JSON-compatible JavaScript object.
 */
export function decodedFieldsToJson(fields: DecodedField[]): any {
    const result: { [key: string]: any } = {};

    fields.forEach(field => {
        // Use the field name from the schema if available, otherwise a generic name.
        const key = field.fieldName || `unknown_field_${field.fieldNumber}`;
        const value = getPrimitiveValue(field.content, field.typeName);

        // Handle repeated fields.
        // The value itself might be an array if it's a packed repeated field.
        if (result.hasOwnProperty(key)) {
            if (!Array.isArray(result[key])) {
                // Convert to an array on the second occurrence of the key.
                result[key] = [result[key]];
            }
            result[key].push(value);
        } else {
            // For unpacked repeated fields, the schema flag is not enough, as the JSON converter
            // sees one field at a time. The logic to create an array must be based on seeing the key again.
            // For packed fields, `value` is already an array, so it's assigned directly.
             result[key] = value;
        }
    });
    
    // Post-process to merge packed and unpacked fields of the same name, which is a rare but valid case.
    for (const key in result) {
        if (Array.isArray(result[key]) && result[key].some(Array.isArray)) {
            result[key] = result[key].flat();
        }
    }

    return result;
}