import React, { useState, useCallback, useRef, useEffect } from 'react';
import { decodeProtobuf } from './services/protobufDecoder';
import { decodedFieldsToJson, buildJsonPathMap } from './services/jsonConverter';
import { exportToJson, exportToCsv } from './services/exporter';
import type { DecodedField } from './types';
import { ResultsTable } from './components/ResultsTable';
import { JsonViewer } from './components/JsonViewer';
import { UploadIcon, SchemaIcon, TableIcon, JsonIcon, CaretDownIcon, SpinnerIcon, ErrorIcon } from './components/Icons';
import CodeEditor from './components/CodeEditor';

const exampleProto = `syntax = "proto3";

message TimeSeriesDataSet {
   repeated TimeSeriesData TimeSeriesDatas = 1;
   map<uint32,string> ExtraProperties = 10;
}

message TimeSeriesData {
    uint32 Id = 1;
    uint32 Time = 2;
    oneof Value {
         sint32 IntValue = 3;
         float FloatValue = 4;
         bytes BytesValue = 5;
         int32 TimeValue = 6;
         fixed32 FixedValue = 7;
     }
    uint32 DevId = 8;
    uint32 DevIdType = 9;
    map<uint32,string> ExtraProperties = 10;
}`;

type InputFormat = 'hex' | 'base64' | 'decimal';
type ViewMode = 'table' | 'json';

const placeholders: Record<InputFormat, string> = {
  hex: 'e.g., 0a 1b 2c  or  0x0a,0x1b,0x2c',
  base64: 'e.g., CpsBCMc=',
  decimal: 'e.g., 10, 27, 44',
};

const formatLabels: Record<InputFormat, string> = {
  hex: 'Hexadecimal',
  base64: 'Base64',
  decimal: 'Decimal Bytes',
};

const formatDescriptions: Record<InputFormat, string> = {
  hex: 'Handles various formats, including with spaces, commas, or "0x" prefixes.',
  base64: 'Standard Base64 encoded string.',
  decimal: 'Numbers from 0-255, separated by commas or spaces.',
};

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


function App() {
  const [hexData, setHexData] = useState<string>('0a 1a 08 c6 e6 07 10 98 81 b4 c8 06 25 00 00 c8 41 40 a8 e6 07 52 05 08 01 12 01 32 0a 1a 08 c6 e6 07 10 f0 85 b4 c8 06 25 00 00 c8 41 40 a8 e6 07 52 05 08 01 12 01 32 0a 1a 08 c6 e6 07 10 8c 8a b4 c8 06 25 00 00 c8 41 40 a8 e6 07 52 05 08 01 12 01 32 0a 1a 08 c6 e6 07 10 a0 8f b4 c8 06 25 00 00 c8 41 40 a8 e6 07 52 05 08 01 12 01 32 0a 1a 08 c6 e6 07 10 9c 88 b4 c8 06 25 00 00 c8 41 40 a8 e6 07 52 05 08 01 12 01 32 0a 1a 08 c6 e6 07 10 f4 8c b4 c8 06 25 00 00 c8 41 40 a8 e6 07 52 05 08 01 12 01 32 0a 1a 08 c6 e6 07 10 c0 91 b4 c8 06 25 00 00 c8 41 40 a8 e6 07 52 05 08 01 12 01 32 0a 1a 08 c6 e6 07');
  const [protoSchema, setProtoSchema] = useState<string>(exampleProto);
  const [results, setResults] = useState<{ fields: DecodedField[]; json: any; error?: string; unparsedHex?: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [inputFormat, setInputFormat] = useState<InputFormat>('hex');
  const [activeView, setActiveView] = useState<ViewMode>('table');
  const [inputErrorRange, setInputErrorRange] = useState<[number, number] | null>(null);
  const [highlightedByteRange, setHighlightedByteRange] = useState<[number, number] | null>(null);
  const [highlightedCharRange, setHighlightedCharRange] = useState<[number, number] | null>(null);
  const [sourceMap, setSourceMap] = useState<number[]>([]);
  const [jsonPathMap, setJsonPathMap] = useState<Map<string, [number, number]>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSchemaVisible, setIsSchemaVisible] = useState(true);

  const handleDecode = useCallback(() => {
    setIsLoading(true);
    setResults(null);
    setInputErrorRange(null);
    setHighlightedByteRange(null);
    setHighlightedCharRange(null);

    setTimeout(() => {
      try {
        if (inputFormat === 'hex') {
          const map: number[] = [];
          const cleanedChars: string[] = [];
          let i = 0;
          while (i < hexData.length) {
            const char = hexData[i];
            if (char === '0' && i + 1 < hexData.length && hexData[i + 1].toLowerCase() === 'x') {
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
          const cleanedHex = cleanedChars.join('');

          if (cleanedHex.length === 0 && hexData.trim().length > 0) {
            setResults({ fields: [], json: null, error: "Input contains no valid hexadecimal characters." });
            return;
          }
          if (cleanedHex.length % 2 !== 0) {
            setResults({ fields: [], json: null, error: "Processed data results in an incomplete hex byte string. Please check your input." });
            return;
          }

          const decoded = decodeProtobuf(cleanedHex, protoSchema);
          const json = decoded.fields.length > 0 ? decodedFieldsToJson(decoded.fields) : null;
          setResults({ ...decoded, json });

          if (decoded.fields.length > 0) {
            setJsonPathMap(buildJsonPathMap(decoded.fields));
          }


          if (decoded.error && decoded.errorBytePos !== undefined) {
            const errorCharStart = decoded.errorBytePos * 2;
            if (errorCharStart < map.length) {
              const originalStart = map[errorCharStart];
              const originalEnd = (errorCharStart + 1 < map.length)
                ? map[errorCharStart + 1] + 1
                : map[errorCharStart] + 1;
              setInputErrorRange([originalStart, originalEnd]);
            }
          }
        } else {
          setSourceMap([]); // No source map for non-hex formats
          const cleanedHex = normalizeInputToHex(hexData, inputFormat);
          if (cleanedHex.length === 0) {
            setResults({ fields: [], json: null, error: "Input is empty or could not be parsed." });
            return;
          }
          const decoded = decodeProtobuf(cleanedHex, protoSchema);
          const json = decoded.fields.length > 0 ? decodedFieldsToJson(decoded.fields) : null;
          setResults({ ...decoded, json });
          if (decoded.fields.length > 0) {
            setJsonPathMap(buildJsonPathMap(decoded.fields));
          }
        }
      } catch (e) {
        const error = e instanceof Error ? e.message : 'An unknown decoding error occurred.';
        setResults({ fields: [], json: null, error });
      } finally {
        setIsLoading(false);
      }
    }, 50);
  }, [hexData, protoSchema, inputFormat]);

  useEffect(() => {
    if (!highlightedByteRange || sourceMap.length === 0) {
      setHighlightedCharRange(null);
      return;
    }
    const [startByte, endByte] = highlightedByteRange;
    const startCharIndex = startByte * 2;
    const endCharIndex = (endByte * 2) + 1; // Last char of the end byte

    if (startCharIndex < sourceMap.length && endCharIndex < sourceMap.length) {
      const originalStart = sourceMap[startCharIndex];
      const originalEnd = sourceMap[endCharIndex] + 1;
      setHighlightedCharRange([originalStart, originalEnd]);
    } else {
      setHighlightedCharRange(null);
    }
  }, [highlightedByteRange, sourceMap]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      const uint8 = new Uint8Array(buffer);
      const hex = Array.from(uint8).map(b => b.toString(16).padStart(2, '0')).join(' ');
      setHexData(hex);
      setInputFormat('hex'); // When uploading a file, it's always processed as hex
    };
    reader.onerror = () => {
      setResults({ fields: [], json: null, error: "Failed to read file." });
    }
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset file input
  };

  const getTabClass = (view: ViewMode) => {
    const baseClasses = "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400";
    if (activeView === view) {
      return `${baseClasses} text-blue-600 bg-white border-b-0`;
    }
    return `${baseClasses} text-gray-500 hover:text-gray-700 hover:bg-gray-50`;
  };

  return (
    <div className="h-screen overflow-y-auto bg-gray-100 font-sans text-gray-800">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <header className="mb-6 shrink-0 text-center">
          <h1 className="text-4xl font-bold text-gray-900">Protobuf Decoder</h1>
          <p className="mt-2 text-lg text-gray-600">
            Decode and analyze Protobuf data byte-by-byte, with or without a .proto schema.
          </p>
        </header>

        <main className="flex flex-col gap-8">

          <div className="sticky top-0 z-20 bg-gray-100/95 backdrop-blur-sm py-4 -mt-4">
            <div className="rounded-lg bg-white p-6 shadow-md">
              <label className="mb-2 text-lg font-semibold text-gray-700 block">
                Protobuf Data
              </label>
              <fieldset>
                <legend className="sr-only">Input Format</legend>
                <div className="flex items-center gap-x-6 mb-3">
                  {(Object.keys(formatLabels) as InputFormat[]).map((format) => (
                    <div key={format} className="flex items-center">
                      <input
                        id={`format-${format}`}
                        name="input-format"
                        type="radio"
                        checked={inputFormat === format}
                        onChange={() => setInputFormat(format)}
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor={`format-${format}`} className="ml-2 block text-sm font-medium text-gray-700">
                        {formatLabels[format]}
                      </label>
                    </div>
                  ))}
                </div>
              </fieldset>
              <p className="text-xs text-gray-600 mb-2 -mt-1.5">{formatDescriptions[inputFormat]}</p>
              <div className="relative h-24">
                <CodeEditor
                  value={hexData}
                  onChange={setHexData}
                  placeholder={placeholders[inputFormat]}
                  errorRange={inputErrorRange}
                  highlightRange={highlightedCharRange}
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".bin,.dat,.proto,.pb"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute top-2 right-2 p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full transition-colors z-10"
                  title="Upload binary file"
                  aria-label="Upload binary file"
                >
                  <UploadIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-md">
            <button
              onClick={() => setIsSchemaVisible(!isSchemaVisible)}
              className="flex w-full cursor-pointer items-center justify-between gap-2 text-lg font-semibold text-gray-700 focus:outline-none"
              aria-expanded={isSchemaVisible}
              aria-controls="schema-editor-panel"
            >
              <span className="flex items-center gap-2">
                <SchemaIcon className="w-6 h-6" />
                Proto Schema (Optional)
              </span>
              <CaretDownIcon className={`h-6 w-6 transform transition-transform duration-200 ${isSchemaVisible ? '' : '-rotate-90'}`} />
            </button>
            <div
              id="schema-editor-panel"
              className={`overflow-hidden transition-all duration-300 ease-in-out ${isSchemaVisible ? 'max-h-60 pt-4' : 'max-h-0'}`}
            >
              <div className="h-48">
                <CodeEditor
                  value={protoSchema}
                  onChange={setProtoSchema}
                  placeholder="Paste your .proto schema here to enable schema-based decoding"
                  language="protobuf"
                />
              </div>
            </div>
          </div>

          <div>
            <button
              onClick={handleDecode}
              disabled={isLoading}
              className="w-full flex justify-center items-center bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 ease-in-out transform hover:scale-105 disabled:scale-100"
            >
              {isLoading ? (
                <>
                  <SpinnerIcon className="w-5 h-5 mr-2" />
                  Decoding...
                </>
              ) : (
                'Decode'
              )}
            </button>
          </div>

          <section>
            <div className="flex items-end">
              <h2 className="text-3xl font-bold text-gray-900">Result</h2>
              <div className="ml-auto flex items-center gap-4">
                {results && (results.fields.length > 0 || results.error) && (
                  <div className="flex border-b-2 border-transparent">
                    <button onClick={() => setActiveView('table')} className={getTabClass('table')} aria-pressed={activeView === 'table'}>
                      <TableIcon className="w-5 h-5" />
                      Table
                    </button>
                    <button onClick={() => setActiveView('json')} className={getTabClass('json')} aria-pressed={activeView === 'json'}>
                      <JsonIcon className="w-5 h-5" />
                      JSON
                    </button>
                  </div>
                )}
                {results && results.fields.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportToJson(results.json)}
                      className="px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center gap-1"
                      title="Export as JSON"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                      </svg>
                      JSON
                    </button>
                    <button
                      onClick={() => exportToCsv(results.fields)}
                      className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-1"
                      title="Export as CSV"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                      </svg>
                      CSV
                    </button>
                  </div>
                )}
              </div>
            </div>

            {results ? (
              <div className="mt-2 rounded-lg bg-white p-6 shadow-md">
                {results.error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-start gap-3">
                    <ErrorIcon className="w-6 h-6 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold">Decoding Error</p>
                      <p className="mt-1">{results.error}</p>
                      {results.fields.length > 0 && <p className="mt-2 text-sm">Displaying successfully decoded fields before the error.</p>}
                      {results.unparsedHex && (
                        <div className="mt-4">
                          <p className="font-semibold text-sm">Unparsed Bytes:</p>
                          <pre className="mt-1 p-2 bg-red-50 text-xs text-red-900 rounded-md overflow-x-auto font-mono"><code>{results.unparsedHex}</code></pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {results.fields.length > 0 ? (
                  activeView === 'table' ? (
                    <ResultsTable fields={results.fields} onHighlight={setHighlightedByteRange} />
                  ) : (
                    <JsonViewer json={results.json} jsonPathMap={jsonPathMap} onHighlight={setHighlightedByteRange} />
                  )
                ) : !results.error && (
                  <p className="text-gray-500">No data decoded. Paste data above and click "Decode".</p>
                )}
              </div>
            ) : (
              <div className="mt-2 flex min-h-[200px] items-center justify-center rounded-lg bg-white p-6 shadow-md">
                <p className="text-gray-500">Results will appear here after decoding.</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;