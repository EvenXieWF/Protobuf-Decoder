import { DecodedField } from '../types';

export const exportToJson = (json: any) => {
    if (!json) return;

    const jsonString = JSON.stringify(json, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protobuf-decoded-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const exportToCsv = (fields: DecodedField[]) => {
    if (!fields || fields.length === 0) {
        return;
    }

    const rows: string[][] = [['Byte Range', 'Field #', 'Field Name', 'Type', 'Value']];

    const processField = (field: DecodedField, depth = 0) => {
        const indent = '  '.repeat(depth);
        let value = '';

        if (typeof field.content === 'string') {
            value = field.content;
        } else if (typeof field.content === 'number' || typeof field.content === 'bigint') {
            value = field.content.toString();
        } else if (Array.isArray(field.content) && field.content.length > 0 && typeof field.content[0] === 'object') {
            value = `[${field.content.length} items]`;
        } else if (typeof field.content === 'object' && field.content !== null) {
            // Handle varint, fixed32, fixed64 objects with BigInt support
            value = JSON.stringify(field.content, (_key, val) =>
                typeof val === 'bigint' ? val.toString() : val
            );
        } else {
            value = JSON.stringify(field.content, (_key, val) =>
                typeof val === 'bigint' ? val.toString() : val
            );
        }

        // Escape quotes for CSV
        value = value.replace(/"/g, '""');

        rows.push([
            `${field.byteRange[0]}-${field.byteRange[1]}`,
            field.fieldNumber.toString(),
            indent + (field.fieldName || '-'),
            field.typeName,
            value
        ]);

        // Process nested fields
        if (Array.isArray(field.content) && field.content.length > 0 && typeof field.content[0] === 'object') {
            (field.content as DecodedField[]).forEach(child => processField(child, depth + 1));
        }
    };

    fields.forEach(field => processField(field));

    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    // Add UTF-8 BOM for better Excel compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `protobuf-decoded-${Date.now()}.csv`;
    a.style.display = 'none';

    document.body.appendChild(a);

    // Use setTimeout to ensure the link is in DOM before clicking
    setTimeout(() => {
        a.click();

        // Clean up after a delay to ensure download starts
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }, 0);
};
