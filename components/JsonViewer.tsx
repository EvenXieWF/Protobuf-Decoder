import React, { useState, useCallback, memo } from 'react';
import { CopyIcon, CaretDownIcon, CaretRightIcon } from './Icons';
import { decodeProtobuf } from '../services/protobufDecoder';
import { decodedFieldsToJson } from '../services/jsonConverter';

// --- Helper Functions & Constants ---
const valueStyles: { [key: string]: string } = {
  string: 'text-green-700 dark:text-green-400',
  number: 'text-blue-600 dark:text-blue-400',
  boolean: 'text-purple-600 dark:text-purple-500',
  null: 'text-gray-500 dark:text-gray-400',
};

const getDataType = (data: any): string => {
  if (data === null) return 'null';
  return typeof data;
};

// --- New Decodeable Node Component ---
const DecodableHexNode: React.FC<{ hexString: string, path: string, onPathChange: (path: string | null) => void }> = memo(({ hexString, path, onPathChange }) => {
    const [isDecodeMode, setIsDecodeMode] = useState(false);
    const [nestedSchema, setNestedSchema] = useState('');
    const [decodedJson, setDecodedJson] = useState<any>(null);
    const [decodeError, setDecodeError] = useState<string | null>(null);

    const handleDecode = () => {
        const cleanedHex = hexString.replace(/\s/g, '');
        const { fields, error, unparsedHex } = decodeProtobuf(cleanedHex, nestedSchema);

        if (fields && fields.length > 0) {
            setDecodedJson(decodedFieldsToJson(fields));
        } else {
            setDecodedJson(null);
        }

        let finalErrorMessage: string | null = error || null;
        if (unparsedHex && unparsedHex.trim().length > 0) {
            const unparsedMessage = `Unparsed bytes remain.`;
            finalErrorMessage = finalErrorMessage ? `${finalErrorMessage} ${unparsedMessage}` : unparsedMessage;
        }
        
        setDecodeError(finalErrorMessage);

        if (fields && fields.length > 0 && !finalErrorMessage) {
            setIsDecodeMode(false); // Success, so close the decode UI
        } else if (!finalErrorMessage && (!fields || fields.length === 0)) {
            // No error, but no fields. Keep UI open and show a message.
            setDecodeError("Decoding was successful but did not yield any fields.");
        }
        // If there was an error, isDecodeMode remains true so user can see the error.
    };
    
    const handleRevert = () => {
        setDecodedJson(null);
        setDecodeError(null);
        setIsDecodeMode(false);
    };

    const handleToggleDecodeMode = () => {
        const nextState = !isDecodeMode;
        setIsDecodeMode(nextState);
        // Clear error if user is manually closing the decode UI
        if (!nextState) {
            setDecodeError(null);
        }
    }

    const handleMouseEnter = (e: React.MouseEvent) => {
        e.stopPropagation();
        onPathChange(path);
    };

    const buttonClasses = "ml-2 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold py-0.5 px-2 rounded-md transition focus:outline-none focus:ring-1 focus:ring-blue-400";

    return (
        <div onMouseEnter={handleMouseEnter}>
            <div className="inline-block align-top">
                {decodedJson ? (
                    <>
                        <button onClick={handleRevert} className={`${buttonClasses} bg-yellow-100 hover:bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100 dark:hover:bg-yellow-700`}>
                            Revert
                        </button>
                        <div className="inline-block">
                          <span className="text-gray-800 dark:text-gray-200 ml-2">{'{'}</span>
                          <div className={`pl-5 border-l border-gray-200 dark:border-gray-700 ml-2`}>
                            <JsonNode data={decodedJson} path={path} onPathChange={onPathChange} isRoot={true} skipBrackets={true} />
                          </div>
                          <span className="text-gray-800 dark:text-gray-200 ml-2">{'}'}</span>
                        </div>
                    </>
                ) : (
                    <>
                        <span className={valueStyles.string}>{`"${hexString}"`}</span>
                        <button onClick={handleToggleDecodeMode} className={buttonClasses}>
                            {isDecodeMode ? 'Cancel' : 'Decode Bytes'}
                        </button>
                    </>
                )}
            </div>

            <div className={isDecodeMode ? 'mt-2' : 'hidden'}>
                <div className="p-3 bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-md">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                        Proto Schema (Optional for this field)
                    </label>
                    <textarea
                        value={nestedSchema}
                        onChange={(e) => setNestedSchema(e.target.value)}
                        placeholder="Paste .proto schema for these bytes here..."
                        className="w-full h-24 p-2 mb-2 border border-gray-300 dark:border-gray-500 rounded-md resize-y focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 font-mono text-xs"
                        aria-label="Nested Proto Schema Input"
                    />
                    <button onClick={handleDecode} className={`${buttonClasses} bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-100 dark:hover:bg-blue-700`}>
                        Decode
                    </button>
                    {decodeError && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400 italic bg-red-50 dark:bg-red-900/50 p-2 rounded-md">{decodeError}</p>
                    )}
                </div>
            </div>
        </div>
    );
});


// --- Recursive Node Component ---
interface JsonNodeProps {
  data: any;
  path: string;
  onPathChange: (path: string | null) => void;
  isRoot?: boolean;
  skipBrackets?: boolean;
}

const JsonNode: React.FC<JsonNodeProps> = memo(({ data, path, onPathChange, isRoot = false, skipBrackets = false }) => {
  const [isCollapsed, setIsCollapsed] = useState(isRoot);
  const dataType = getDataType(data);

  const handleMouseEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPathChange(path);
  };
  
  const isDecodable = typeof data === 'object' && data !== null && !Array.isArray(data) && data.hasOwnProperty('__hex__');
  
  if (isDecodable) {
      // This special structure is passed down from the parent map.
      return (
        <div className="inline" onMouseEnter={handleMouseEnter}>
            <DecodableHexNode hexString={data.__hex__} path={path} onPathChange={onPathChange} />
        </div>
      );
  }

  if (dataType !== 'object') {
    const style = valueStyles[dataType] || 'text-gray-800 dark:text-gray-200';
    const displayValue = dataType === 'string' ? `"${data}"` : String(data);
    return (
      <span className={style} onMouseEnter={handleMouseEnter}>{displayValue}</span>
    );
  }

  const isArray = Array.isArray(data);
  const entries = Object.entries(data);
  const bracketOpen = isArray ? '[' : '{';
  const bracketClose = isArray ? ']' : ']';
  const entryCount = entries.length;

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);
  
  const content = (
    <>
        {!skipBrackets && (
             <button 
                onClick={toggleCollapse} 
                className="inline-flex items-center align-middle text-gray-500 hover:text-gray-800 focus:outline-none"
                aria-expanded={!isCollapsed}
                aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            >
                {isCollapsed ? (
                <CaretRightIcon className="w-4 h-4 mr-1" />
                ) : (
                <CaretDownIcon className="w-4 h-4 mr-1" />
                )}
                <span className="text-gray-800 dark:text-gray-200">{bracketOpen}</span>
            </button>
        )}
     

      <div className={`pl-5 border-l border-gray-200 dark:border-gray-700 ml-2 ${isCollapsed && !skipBrackets ? 'hidden' : ''}`}>
        {entries.map(([key, value], index) => {
          const newPath = isArray ? `${path}[${key}]` : `${path}.${key}`;
          
          return (
            <div key={key} className="relative">
              {!isArray && (
                <span className="text-red-700 dark:text-red-400" onMouseEnter={(e) => { e.stopPropagation(); onPathChange(newPath); }}>
                  "{key}":{' '}
                </span>
              )}
              <JsonNode data={value} path={newPath} onPathChange={onPathChange} />
              {index < entryCount - 1 && <span className="text-gray-800 dark:text-gray-200">,</span>}
            </div>
          );
        })}
      </div>
      
      {!skipBrackets && (
        <span className="text-gray-800 dark:text-gray-200" onMouseEnter={handleMouseEnter}>
            {isCollapsed && entryCount > 0 && <span className="text-gray-500 italic px-2">... {entryCount} items ...</span>}
            {bracketClose}
        </span>
      )}
    </>
  );

  return skipBrackets ? content : <div onMouseEnter={handleMouseEnter}>{content}</div>;
});

// --- Main Viewer Component ---
interface JsonViewerProps {
  json: any;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ json }) => {
  const [hoveredPath, setHoveredPath] = useState<string | null>('root');
  const [copyText, setCopyText] = useState('Copy');

  const handleCopy = useCallback(() => {
    // Custom replacer to convert our special __hex__ objects back to strings for copying.
    const replacer = (key: string, value: any) => {
      if (typeof value === 'object' && value !== null && value.hasOwnProperty('__hex__')) {
        return value.__hex__;
      }
      return value;
    };
    navigator.clipboard.writeText(JSON.stringify(json, replacer, 2))
      .then(() => {
        setCopyText('Copied!');
        setTimeout(() => setCopyText('Copy'), 2000);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
        setCopyText('Error!');
         setTimeout(() => setCopyText('Copy'), 2000);
      });
  }, [json]);
  
  const handleMouseLeave = () => setHoveredPath('root');

  return (
    <div className="bg-gray-50 dark:bg-gray-800 font-mono text-sm p-4 rounded-md relative overflow-auto" onMouseLeave={handleMouseLeave}>
      <div className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10 flex justify-between items-center mb-2 pb-2 border-b dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400 p-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded whitespace-nowrap overflow-x-auto">
          Path: <span className="font-semibold">{hoveredPath}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold py-1 px-3 rounded-md transition focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <CopyIcon className="w-4 h-4" />
          {copyText}
        </button>
      </div>
      <JsonNode data={json} path="root" onPathChange={setHoveredPath} isRoot={false} />
    </div>
  );
};