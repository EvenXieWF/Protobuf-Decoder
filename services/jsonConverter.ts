import type { DecodedField, Content, VarintContent, Fixed32Content, Fixed64Content } from '../types';

/**
 * Converts a primitive-like Content type from the decoder into a JSON-friendly value.
 * @param content The decoded content of a field.
 * @returns A JavaScript primitive, object, or array.
 */
const getPrimitiveValue = (content: Content, typeName: string): any => {
    if (typeof content === 'string') {
        // If schema says it's a string, return as is. Otherwise if it's parsable hex bytes, it's likely a sub-message or bytes field.
        if (typeName === 'string' || typeName === 'string (guessed)') {
            return content;
        }
        // For 'bytes', it's already hex-formatted, we can just return it.
        // For embedded messages, we rely on the recursive call below.
        return content;
    }
    
    if (Array.isArray(content)) {
        return decodedFieldsToJson(content); // Recursive call for nested messages
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
        if (result.hasOwnProperty(key)) {
            if (!Array.isArray(result[key])) {
                // Convert to an array on the second occurrence of the key.
                result[key] = [result[key]];
            }
            result[key].push(value);
        } else {
            result[key] = value;
        }
    });

    return result;
}
