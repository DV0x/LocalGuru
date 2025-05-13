'use client';

import { useState, useRef, useEffect } from 'react';

interface Column {
  id: string;
  label: string;
  minWidth: number;
}

interface Cell {
  id: string;
  content: string;
  className?: string;
}

interface Row {
  id: string;
  cells: Cell[];
}

interface ResizableTableProps {
  columns: Column[];
  data: Row[];
  emptyMessage?: string;
}

export default function ResizableTable({ columns, data, emptyMessage = 'No data available' }: ResizableTableProps) {
  // Initialize column widths
  const initialWidths = columns.reduce<Record<string, number>>((acc, col) => {
    acc[col.id] = col.minWidth;
    return acc;
  }, {});
  
  const [widths, setWidths] = useState<Record<string, number>>(initialWidths);
  const [resizing, setResizing] = useState<string | null>(null);
  const [startPos, setStartPos] = useState(0);
  const tableRef = useRef<HTMLTableElement>(null);

  // Set up the resize handler
  const startResize = (columnId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setResizing(columnId);
    setStartPos(e.pageX);
  };
  
  // Handle resize movement
  useEffect(() => {
    if (!resizing) return;
    
    const currentWidth = widths[resizing];
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing) return;
      
      const diff = e.pageX - startPos;
      const newWidth = Math.max(100, currentWidth + diff);
      
      // Update the width of the column
      setWidths(prev => ({
        ...prev,
        [resizing]: newWidth
      }));
    };
    
    const handleMouseUp = () => {
      setResizing(null);
    };
    
    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Add a class to the body to change the cursor
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    // Clean up
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };
  }, [resizing, startPos, widths]);
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            {columns.map((column, index) => (
              <th 
                key={column.id}
                className="relative px-4 py-2 text-left border-b border-r border-gray-300"
                style={{ width: widths[column.id] }}
              >
                {column.label}
                <div 
                  className={`absolute top-0 right-0 w-4 h-full cursor-col-resize ${resizing === column.id ? 'bg-blue-200' : 'hover:bg-blue-100'}`}
                  onMouseDown={(e) => startResize(column.id, e)}
                >
                  <div className="absolute right-[6px] top-0 bottom-0 w-[1px] bg-gray-300"></div>
                  <div className="absolute right-[8px] top-0 bottom-0 w-[1px] bg-gray-300"></div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map(row => (
              <tr key={row.id} className="border-b hover:bg-gray-50">
                {row.cells.map((cell, cellIndex) => (
                  <td 
                    key={`${row.id}-${cell.id}`}
                    className={`px-4 py-2 border-r border-gray-300 ${cell.className || ''}`}
                    style={{ 
                      width: widths[columns[cellIndex].id],
                      maxWidth: widths[columns[cellIndex].id],
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    title={cell.content}
                  >
                    {cell.content}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-4 py-2 text-center text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="mt-2 text-xs text-gray-500">
        Drag the column dividers to resize. Hover over cells to see full content.
      </div>
    </div>
  );
} 