import React, { useState, useCallback, useRef } from 'react';
import { decodeProtobuf } from './services/protobufDecoder';
import type { DecodedField } from './types';
import { ResultsTable } from './components/ResultsTable';
import { UploadIcon, SchemaIcon } from './components/Icons';

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

function App() {
  const [hexData, setHexData] = useState<string>('0a 1a 08 c6 e6 07 10 98 81 b4 c8 06 25 00 00 c8 41 40 a8 e6 07 52 05 08 01 12 01 32 0a 1a 08 c6 e6 07 10 f0 85 b4 c8 06 25 00 00 c8 41 40 a8 e6 07 52 05 08 01 12 01 32 0a 1a 08 c6 e6 07 10 8c 8a b4 c8 06 25 00 00 c8 41 40 a8 e6 07 52 05 08 01 12 01 32 0a 1a 08 c6 e6 07 10 a0 8f b4 c8 06 25 00 00 c8 41 40 a8 e6 07 52 05 08 01 12 01 32 0a 1a 08 c6 e6 07 10 9c 88 b4 c8 06 25 00 00 c8 41 40 a8 e6 07 52 05 08 01 12 01 32 0a 1a 08 c6 e6 07 10 f4 8c b4 c8 06 25 00 00 c8 41 40 a8 e6 07 52 05 08 01 12 01 32 0a 1a 08 c6 e6 07 10 c0 91 b4 c8 06 25 00 00 c8 41 40 a8 e6 07 52 05 08 01 12 01 32 0a 1a 08 c6 e6 07');
  const [protoSchema, setProtoSchema] = useState<string>(exampleProto);
  const [results, setResults] = useState<{ fields: DecodedField[]; error?: string; unparsedHex?: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDecode = useCallback(() => {
    setIsLoading(true);
    setResults(null);

    setTimeout(() => {
      try {
        const cleanedHex = hexData.replace(/[^0-9a-fA-F]/g, '');
        if (cleanedHex.length === 0) {
            setResults({ fields: [], error: "Input is empty." });
            return;
        }
        if (cleanedHex.length % 2 !== 0) {
            setResults({ fields: [], error: "Hex string must have an even number of characters." });
            return;
        }
        const decoded = decodeProtobuf(cleanedHex, protoSchema);
        setResults(decoded);
      } catch (e) {
        const error = e instanceof Error ? e.message : 'An unknown decoding error occurred.';
        setResults({ fields: [], error });
      } finally {
        setIsLoading(false);
      }
    }, 50);
  }, [hexData, protoSchema]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      const uint8 = new Uint8Array(buffer);
      const hex = Array.from(uint8).map(b => b.toString(16).padStart(2, '0')).join(' ');
      setHexData(hex);
    };
    reader.onerror = () => {
        setResults({ fields: [], error: "Failed to read file." });
    }
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset file input
  };

  return (
    <div className="flex h-screen flex-col bg-gray-100 font-sans text-gray-800">
      <div className="container mx-auto flex flex-grow flex-col p-4 sm:p-6 lg:p-8">
        <header className="mb-6 text-center">
          <h1 className="text-4xl font-bold text-gray-900">Protobuf Decoder</h1>
          <p className="mt-2 text-lg text-gray-600">
            Decode and analyze Protobuf data byte-by-byte, with or without a .proto schema.
          </p>
        </header>

        <main className="flex min-h-0 flex-grow flex-col gap-6">
          {/* Inputs Section */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
              <div>
                <label className="flex items-center gap-2 mb-2 text-lg font-semibold text-gray-700">
                  Protobuf Hex Data
                </label>
                <div className="relative">
                  <textarea
                    value={hexData}
                    onChange={(e) => setHexData(e.target.value)}
                    placeholder="Paste your protobuf data as a hex string here (e.g., 08 96 01)"
                    className="w-full h-48 p-4 border border-gray-300 rounded-md resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow font-mono text-sm"
                    aria-label="Protobuf Hex Data Input"
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
                    className="absolute top-3 right-3 p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full transition-colors"
                    title="Upload binary file"
                    aria-label="Upload binary file"
                  >
                    <UploadIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div>
                <label className="flex items-center gap-2 mb-2 text-lg font-semibold text-gray-700">
                  <SchemaIcon className="w-6 h-6" />
                  Proto Schema (Optional)
                </label>
                <textarea
                    value={protoSchema}
                    onChange={(e) => setProtoSchema(e.target.value)}
                    placeholder="Paste your .proto schema here to enable schema-based decoding"
                    className="w-full h-48 p-4 border border-gray-300 rounded-md resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow font-mono text-sm"
                    aria-label="Proto Schema Input"
                />
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleDecode}
                disabled={isLoading}
                className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 ease-in-out transform hover:scale-105 disabled:scale-100"
              >
                {isLoading ? 'Decoding...' : 'Decode'}
              </button>
            </div>
          </div>
          
          {/* Results Section */}
          <div className="flex min-h-0 flex-grow flex-col">
            <h2 className="text-3xl font-bold text-gray-900 mb-4 shrink-0">Result</h2>
            {results ? (
              <div className="flex-grow overflow-auto rounded-lg bg-white p-6 shadow-md">
                {results.error && (
                  <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
                    <p className="font-bold">Decoding Error:</p>
                    <p>{results.error}</p>
                    {results.fields.length > 0 && <p className="mt-2 text-sm">Displaying successfully decoded fields before the error.</p>}
                     {results.unparsedHex && (
                        <div className="mt-4">
                            <p className="font-semibold text-sm">Unparsed Bytes:</p>
                            <pre className="mt-1 p-2 bg-red-50 text-xs text-red-900 rounded-md overflow-x-auto font-mono"><code>{results.unparsedHex}</code></pre>
                        </div>
                    )}
                  </div>
                )}
                {results.fields.length > 0 ? (
                  <ResultsTable fields={results.fields} />
                ) : !results.error && (
                  <p className="text-gray-500">No data decoded. Paste hex data above and click "Decode".</p>
                )}
              </div>
            ) : (
                <div className="flex min-h-[200px] flex-grow items-center justify-center rounded-lg bg-white p-6 shadow-md">
                    <p className="text-gray-500">Results will appear here after decoding.</p>
                </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
