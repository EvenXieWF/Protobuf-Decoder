import React, { useState } from 'react';
import type { DecodedField, Content, VarintContent, Fixed32Content, Fixed64Content } from '../types';
import { WireType } from '../types';
import { decodeProtobuf } from '../services/protobufDecoder';

const renderFieldValue = (content: Content) => {
    if (typeof content === 'object' && content !== null && !Array.isArray(content)) {
        switch (content.type) {
            case 'varint':
                const vContent = content as VarintContent;
                return (
                    <div className="text-xs">
                        <p><span className="font-semibold">uint:</span> {vContent.asUint.toString()}</p>
                        <p><span className="font-semibold">sint:</span> {vContent.asSint.toString()}</p>
                    </div>
                );
            case 'fixed32':
                const f32Content = content as Fixed32Content;
                return (
                    <div className="text-xs">
                        <p><span className="font-semibold">float:</span> {f32Content.asFloat}</p>
                        <p><span className="font-semibold">uint:</span> {f32Content.asUint}</p>
                        <p><span className="font-semibold">sint:</span> {f32Content.asInt}</p>
                    </div>
                );
            case 'fixed64':
                const f64Content = content as Fixed64Content;
                return (
                    <div className="text-xs">
                        <p><span className="font-semibold">double:</span> {f64Content.asDouble}</p>
                        <p><span className="font-semibold">uint:</span> {f64Content.asUint.toString()}</p>
                        <p><span className="font-semibold">sint:</span> {f64Content.asInt.toString()}</p>
                    </div>
                );
        }
    }

    return <span className="font-mono text-xs break-all">{content.toString()}</span>;
};

const ContentCell: React.FC<{ field: DecodedField, onHighlight: (range: [number, number] | null) => void }> = ({ field, onHighlight }) => {
    const [isDecodeBytesExpanded, setIsDecodeBytesExpanded] = useState(false);
    const [decodedSubFields, setDecodedSubFields] = useState<DecodedField[] | null>(null);
    const [nestedProtoSchema, setNestedProtoSchema] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isNestedTableExpanded, setIsNestedTableExpanded] = useState(true);

    const isExpandableForDecode = field.wireType === WireType.LENGTH_DELIMITED && typeof field.content === 'string';

    const handleDecodeBytes = () => {
        if (typeof field.content !== 'string') return;
        const hexPayload = field.content.replace(/\s/g, '');
        const result = decodeProtobuf(hexPayload, nestedProtoSchema, field.payloadStartOffset || 0);

        if (result.fields && result.fields.length > 0) {
            setDecodedSubFields(result.fields);
        } else {
            setDecodedSubFields(null);
        }

        let finalErrorMessage = result.error ? `Nested Decode Error: ${result.error}` : null;
        if (result.unparsedHex && result.unparsedHex.trim().length > 0) {
            const unparsedMessage = 'Unparsed bytes remain.';
            finalErrorMessage = finalErrorMessage ? `${finalErrorMessage} ${unparsedMessage}` : unparsedMessage;
        }

        setError(finalErrorMessage);
    };

    const handleToggleDecodeExpand = () => {
        const nextState = !isDecodeBytesExpanded;
        setIsDecodeBytesExpanded(nextState);
        if (!nextState) {
            setDecodedSubFields(null);
            setNestedProtoSchema('');
            setError(null);
        }
    };

    if (Array.isArray(field.content)) {
        if (field.content.length > 0 && typeof field.content[0] === 'object' && field.content[0] !== null && 'fieldNumber' in field.content[0]) {
            return (
                <div>
                    <div className="flex items-center">
                        <button
                            onClick={() => setIsNestedTableExpanded(!isNestedTableExpanded)}
                            className="font-mono text-xs mr-2 px-1.5 py-0.5 bg-gray-200 hover:bg-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                            aria-expanded={isNestedTableExpanded}
                        >
                            {isNestedTableExpanded ? '−' : '+'}
                        </button>
                        <span className="text-gray-600 italic">
                            {field.typeName} ({field.content.length} fields)
                        </span>
                    </div>
                    {isNestedTableExpanded && <ResultsTable fields={field.content as DecodedField[]} isNested={true} onHighlight={onHighlight} />}
                </div>
            );
        }

        const items = field.content as (string | number | bigint)[];
        return (
            <div className="text-xs space-y-1">
                {items.map((item, index) => (
                    <div key={index} className="font-mono bg-gray-50 px-1 rounded-sm">{item.toString()}</div>
                ))}
            </div>
        );
    }

    const buttonClasses = "mt-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-1 px-2 rounded-md transition focus:outline-none focus:ring-2 focus:ring-blue-400";

    return (
        <div>
            <div>
                {renderFieldValue(field.content)}
                {isExpandableForDecode && (
                    <button onClick={handleToggleDecodeExpand} className={buttonClasses}>
                        {isDecodeBytesExpanded ? 'Collapse' : 'Decode Bytes'}
                    </button>
                )}
            </div>
            {isDecodeBytesExpanded && (
                <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                        Proto Schema (Optional for this field)
                    </label>
                    <textarea
                        value={nestedProtoSchema}
                        onChange={(e) => setNestedProtoSchema(e.target.value)}
                        placeholder="Paste .proto schema for these bytes here..."
                        className="w-full h-24 p-2 mb-2 border border-gray-300 rounded-md resize-y focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs"
                        aria-label="Nested Proto Schema Input"
                    />
                    <button onClick={handleDecodeBytes} className={`${buttonClasses} bg-blue-100 hover:bg-blue-200 text-blue-800`}>
                        Decode
                    </button>

                    <div className="mt-2">
                        {error && (
                            <p className="text-xs text-red-600 italic bg-red-50 p-2 rounded-md">{error}</p>
                        )}
                        {decodedSubFields && decodedSubFields.length > 0 ? (
                            <ResultsTable fields={decodedSubFields} isNested={true} onHighlight={onHighlight} />
                        ) : decodedSubFields && !error ? (
                            <p className="text-xs text-gray-500 italic mt-2">Decoding did not yield any fields.</p>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
};


interface ResultsTableProps {
    fields: DecodedField[];
    isNested?: boolean;
    onHighlight: (range: [number, number] | null) => void;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ fields, isNested = false, onHighlight }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 100;
    const totalPages = Math.ceil(fields.length / PAGE_SIZE);

    const paginatedFields = fields.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    return (
        <div className={`${isNested ? 'w-full' : 'h-full'} flex flex-col`}>
            <div className="flex bg-gray-100 text-xs font-medium text-gray-700 uppercase border-b shrink-0 scrollbar-stable min-w-max">
                <div className="w-32 px-4 py-3">Byte Range</div>
                <div className="w-20 px-4 py-3">Field #</div>
                <div className="w-40 px-4 py-3">Field Name</div>
                <div className="w-32 px-4 py-3">Type</div>
                <div className="flex-1 px-4 py-3">Content</div>
            </div>
            <div className={isNested ? 'overflow-x-auto' : 'flex-1 overflow-auto'}>
                {paginatedFields.map((field, index) => (
                    <div
                        key={`${field.fieldNumber}-${field.byteRange.join('-')}-${index}`}
                        className="flex border-b hover:bg-blue-50 items-start text-sm"
                        onMouseEnter={() => onHighlight(field.byteRange)}
                        onMouseLeave={() => onHighlight(null)}
                    >
                        <div className="w-32 px-4 py-2 font-mono break-words shrink-0 border-r">{`${field.byteRange[0]}-${field.byteRange[1]}`}</div>
                        <div className="w-20 px-4 py-2 shrink-0 border-r">{field.fieldNumber}</div>
                        <div className="w-40 px-4 py-2 text-blue-600 font-semibold break-words shrink-0 border-r">{field.fieldName || '-'}</div>
                        <div className="w-32 px-4 py-2 font-semibold break-words shrink-0 border-r">{field.typeName}</div>
                        <div className="flex-1 px-4 py-2 break-words"><ContentCell field={field} onHighlight={onHighlight} /></div>
                    </div>
                ))}
            </div>
            {totalPages > 1 && !isNested && (
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t text-xs shrink-0">
                    <div className="text-gray-600">
                        Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, fields.length)} of {fields.length} entries
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="px-2 py-1 border rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <span className="flex items-center px-2">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="px-2 py-1 border rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};