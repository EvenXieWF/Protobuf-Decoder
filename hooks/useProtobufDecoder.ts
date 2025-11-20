import { useState, useCallback, useEffect, useRef } from 'react';
import { buildJsonPathMap } from '../services/jsonConverter';
import type { DecodedField, InputFormat } from '../types';

export interface DecodeResultState {
    fields: DecodedField[];
    json: any;
    error?: string;
    unparsedHex?: string;
}

const normalizeInputToHex = (input: string, format: InputFormat): string => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return '';

    try {
        switch (format) {
            case 'base64':
                const binaryString = atob(trimmedInput);
                let hex = '';
                for (let i = 0; i < binaryString.length; i++) {
                    const hexChar = binaryString.charCodeAt(i).toString(16);
                    hex += hexChar.padStart(2, '0');
                }
                return hex;
            case 'decimal':
                return trimmedInput
                    .replace(/[,;]/g, ' ') // support commas and semicolons as separators
                    .split(/\s+/) // split by one or more spaces
                    .filter(s => s)
                    .map(s => {
                        const num = parseInt(s, 10);
                        if (isNaN(num) || num < 0 || num > 255) {
                            throw new Error(`Invalid decimal byte value: "${s}"`);
                        }
                        return num.toString(16).padStart(2, '0');
                    })
                    .join('');
            case 'hex':
            default:
                return trimmedInput
                    .replace(/0x/gi, '')
                    .replace(/[^0-9a-fA-F]/g, '');
        }
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown parsing error';
        throw new Error(`Invalid ${format} input: ${message}`);
    }
};

export function useProtobufDecoder() {
    const [results, setResults] = useState<DecodeResultState | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [inputErrorRange, setInputErrorRange] = useState<[number, number] | null>(null);
    const [sourceMap, setSourceMap] = useState<number[]>([]);
    const [jsonPathMap, setJsonPathMap] = useState<Map<string, [number, number]>>(new Map());

    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        // Instantiate the worker
        workerRef.current = new Worker(new URL('../services/decoder.worker.ts', import.meta.url), {
            type: 'module',
        });

        workerRef.current.onmessage = (e) => {
            const { success, data, error } = e.data;
            if (success) {
                setResults(data);
                if (data.fields.length > 0) {
                    // We still build the path map on the main thread for now as it returns a Map
                    // which might need special handling if transferred, though structured clone supports it.
                    // To be safe and simple, we do it here. It's usually fast enough.
                    setJsonPathMap(buildJsonPathMap(data.fields));
                }
            } else {
                setResults({ fields: [], json: null, error });
            }
            setIsLoading(false);
        };

        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    const decode = useCallback((input: string | Uint8Array, protoSchema: string, inputFormat: InputFormat) => {
        setIsLoading(true);
        setResults(null);
        setInputErrorRange(null);

        // Use setTimeout to allow UI to update loading state before heavy sync work (cleaning hex)
        setTimeout(() => {
            try {
                let processedInput: string | Uint8Array = input;
                let map: number[] = [];

                if (typeof input === 'string') {
                    if (inputFormat === 'hex') {
                        const cleanedChars: string[] = [];
                        let i = 0;
                        while (i < input.length) {
                            const char = input[i];
                            if (char === '0' && i + 1 < input.length && input[i + 1].toLowerCase() === 'x') {
                                i += 2;
                            } else if (/[0-9a-fA-F]/.test(char)) {
                                cleanedChars.push(char);
                                map.push(i);
                                i++;
                            } else {
                                i++;
                            }
                        }
                        setSourceMap(map);
                        processedInput = cleanedChars.join('');

                        if (processedInput.length === 0 && input.trim().length > 0) {
                            setResults({ fields: [], json: null, error: "Input contains no valid hexadecimal characters." });
                            setIsLoading(false);
                            return;
                        }
                        if (processedInput.length % 2 !== 0) {
                            setResults({ fields: [], json: null, error: "Processed data results in an incomplete hex byte string. Please check your input." });
                            setIsLoading(false);
                            return;
                        }
                    } else {
                        setSourceMap([]); // No source map for non-hex formats
                        processedInput = normalizeInputToHex(input, inputFormat);
                        if (processedInput.length === 0) {
                            setResults({ fields: [], json: null, error: "Input is empty or could not be parsed." });
                            setIsLoading(false);
                            return;
                        }
                    }
                } else {
                    // Uint8Array input
                    setSourceMap([]);
                    processedInput = input;
                }

                // Post to worker
                if (workerRef.current) {
                    workerRef.current.postMessage({ input: processedInput, protoSchema });
                } else {
                    setResults({ fields: [], json: null, error: "Worker not initialized." });
                    setIsLoading(false);
                }

            } catch (e) {
                const error = e instanceof Error ? e.message : 'An unknown decoding error occurred.';
                setResults({ fields: [], json: null, error });
                setIsLoading(false);
            }
        }, 50);
    }, []);

    // Effect to calculate inputErrorRange when results change
    useEffect(() => {
        if (results?.error && results.fields && results.fields.length >= 0 && sourceMap.length > 0) {
            // We need to know the error byte pos.
            // The worker returns 'errorBytePos' in the result if it exists.
            // But we need to cast results to check for it as it's not in the interface explicitly?
            // It IS in the DecodeResult type returned by decodeProtobuf, so it should be in 'results' data.
            // Let's check DecodeResultState definition.
            const res = results as any;
            if (res.errorBytePos !== undefined) {
                const errorCharStart = res.errorBytePos * 2;
                if (errorCharStart < sourceMap.length) {
                    const originalStart = sourceMap[errorCharStart];
                    const originalEnd = (errorCharStart + 1 < sourceMap.length)
                        ? sourceMap[errorCharStart + 1] + 1
                        : sourceMap[errorCharStart] + 1;
                    setInputErrorRange([originalStart, originalEnd]);
                }
            }
        }
    }, [results, sourceMap]);

    return {
        decode,
        results,
        isLoading,
        inputErrorRange,
        sourceMap,
        jsonPathMap,
        setResults
    };
}
