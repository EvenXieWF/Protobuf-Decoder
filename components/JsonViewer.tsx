import React, { useState, useCallback, memo } from 'react';
import { CopyIcon, CaretDownIcon, CaretRightIcon } from './Icons';

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

// --- Recursive Node Component ---
interface JsonNodeProps {
  data: any;
  path: string;
  onPathChange: (path: string | null) => void;
  isRoot?: boolean;
}

const JsonNode: React.FC<JsonNodeProps> = memo(({ data, path, onPathChange, isRoot = false }) => {
  const [isCollapsed, setIsCollapsed] = useState(isRoot);
  const dataType = getDataType(data);

  const handleMouseEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPathChange(path);
  };
  
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
  const bracketClose = isArray ? ']' : '}';
  const entryCount = entries.length;

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <div onMouseEnter={handleMouseEnter}>
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

      {!isCollapsed && (
        <div className="pl-5 border-l border-gray-200 dark:border-gray-700 ml-2">
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
      )}
      <span className="text-gray-800 dark:text-gray-200" onMouseEnter={handleMouseEnter}>
        {isCollapsed && entryCount > 0 && <span className="text-gray-500 italic px-2">... {entryCount} items ...</span>}
        {bracketClose}
      </span>
    </div>
  );
});

// --- Main Viewer Component ---
interface JsonViewerProps {
  json: any;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ json }) => {
  const [hoveredPath, setHoveredPath] = useState<string | null>('root');
  const [copyText, setCopyText] = useState('Copy');

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(json, null, 2))
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
