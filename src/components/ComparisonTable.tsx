import React from 'react';
import { ComparisonResult } from '../utils/fileUtils';
import { motion } from 'motion/react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface ComparisonTableProps {
  result: ComparisonResult;
}

const ROWS_PER_PAGE = 200;

export const ComparisonTable: React.FC<ComparisonTableProps> = ({ result }) => {
  const [displayLimit, setDisplayLimit] = React.useState(ROWS_PER_PAGE);
  
  const totalCells = result.rows.length * result.headers.length;
  const totalMismatches = result.rows.reduce((acc, row) => 
    acc + (row.status === 'matched' ? row.mismatches.filter(m => m).length : 0), 0
  );
  const totalNew = result.rows.filter(row => row.status === 'not_found_in_reference').length;
  const accuracy = totalCells > 0 ? ((1 - totalMismatches / totalCells) * 100).toFixed(1) : '100';

  const displayedRows = result.rows.slice(0, displayLimit);
  const hasMore = result.rows.length > displayLimit;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600">
            <AlertCircle size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Mismatches</p>
            <p className="text-xl font-bold text-slate-900">{totalMismatches}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
            <AlertCircle size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">New Records</p>
            <p className="text-xl font-bold text-slate-900">{totalNew}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Match Rate</p>
            <p className="text-xl font-bold text-slate-900">{accuracy}%</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600">
            <div className="font-bold text-sm">#</div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Rows</p>
            <p className="text-xl font-bold text-slate-900">{result.rows.length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-bottom border-slate-200">
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200 w-12 text-center">#</th>
                {result.headers.map((header, i) => (
                  <th key={i} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[150px]">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedRows.map((row, rowIndex) => (
                <motion.tr 
                  key={rowIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`${row.status === 'not_found_in_reference' ? 'bg-amber-50/30' : 'hover:bg-slate-50/50'} transition-colors`}
                >
                  <td className="px-4 py-3 text-xs font-medium text-slate-400 border-r border-slate-100 text-center relative">
                    {rowIndex + 1}
                    {row.status === 'not_found_in_reference' && (
                      <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-6 bg-amber-400 rounded-r-full" title="Not found in reference" />
                    )}
                  </td>
                  {row.data.map((cell, colIndex) => {
                    const isMismatch = row.mismatches[colIndex];
                    const refValue = row.referenceData?.[colIndex];
                    const isNotFound = row.status === 'not_found_in_reference';
                    
                    return (
                      <td key={colIndex} className="px-4 py-3 relative group">
                        <div className={`text-sm ${isMismatch ? 'text-rose-600 font-bold' : isNotFound ? 'text-slate-500 italic' : 'text-slate-700'}`}>
                          {String(cell || '')}
                        </div>
                        {isMismatch && (
                          <div className="absolute inset-0 bg-rose-50/50 pointer-events-none" />
                        )}
                        {isMismatch && refValue !== undefined && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-20 pointer-events-none shadow-xl border border-slate-700">
                            <span className="text-slate-400 mr-1">Ref:</span> {String(refValue)}
                          </div>
                        )}
                        {isNotFound && colIndex === 0 && (
                          <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-amber-600 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none shadow-lg uppercase tracking-wider">
                            Record not found in reference file
                          </div>
                        )}
                      </td>
                    );
                  })}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {hasMore && (
          <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col items-center gap-3">
            <p className="text-sm text-slate-500 font-medium">
              Showing {displayLimit} of {result.rows.length} rows. 
              Large datasets are truncated for performance.
            </p>
            <button
              onClick={() => setDisplayLimit(prev => prev + ROWS_PER_PAGE)}
              className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm"
            >
              Load More Rows
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
