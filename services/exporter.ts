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
    if (!fields || fields.length === 0) return;

    const rows: string[][] = [['Byte Range', 'Field #', 'Field Name', 'Type', 'Value']];

    const processField = (field: DecodedField, depth = 0) => {
        const indent = '  '.repeat(depth);
        let value = '';

        if (typeof field.content === 'string') {
            value = field.content;
        } else if (Array.isArray(field.content) && field.content.length > 0 && typeof field.content[0] === 'object') {
            value = `[${field.content.length} items]`;
        } else {
            value = JSON.stringify(field.content);
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
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protobuf-decoded-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
