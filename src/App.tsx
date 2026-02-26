import React, { useState, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { ComparisonTable } from './components/ComparisonTable';
import { parseFile, compareFilesAsync, generateTextReport, FileData, ComparisonResult } from './utils/fileUtils';
import { FileSearch, RefreshCw, Download, Info, AlertTriangle, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

export default function App() {
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [refFile, setRefFile] = useState<File | null>(null);
  const [mainData, setMainData] = useState<FileData | null>(null);
  const [refData, setRefData] = useState<FileData | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [keyColumns, setKeyColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleMainFileSelect = async (file: File) => {
    setMainFile(file);
    setError(null);
    try {
      const data = await parseFile(file);
      setMainData(data);
    } catch (err: any) {
      setError(`Error parsing main file: ${err.message}`);
    }
  };

  const handleRefFileSelect = async (file: File) => {
    setRefFile(file);
    setError(null);
    try {
      const data = await parseFile(file);
      setRefData(data);
    } catch (err: any) {
      setError(`Error parsing reference file: ${err.message}`);
    }
  };

  const handleCompare = useCallback(async () => {
    if (!mainData || !refData) return;
    
    setIsLoading(true);
    setProgress(0);
    setError(null);
    
    try {
      const comparisonResult = await compareFilesAsync(
        mainData, 
        refData, 
        keyColumns.length > 0 ? keyColumns : undefined,
        (p) => setProgress(p)
      );
      setResult(comparisonResult);
    } catch (err: any) {
      setError(`Comparison failed: ${err.message}`);
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  }, [mainData, refData, keyColumns]);

  const handleReset = () => {
    setMainFile(null);
    setRefFile(null);
    setMainData(null);
    setRefData(null);
    setResult(null);
    setKeyColumns([]);
    setError(null);
  };

  const commonHeaders = mainData && refData 
    ? mainData.headers.filter(h => refData.headers.includes(h))
    : [];

  const handleExport = () => {
    if (!result) return;

    const exportData = result.rows.map((row, i) => {
      const exportRow: any = { 
        '#': i + 1,
        'STATUS': row.status === 'not_found_in_reference' ? 'NOT FOUND' : 'MATCHED'
      };
      result.headers.forEach((header, colIndex) => {
        exportRow[header] = row.data[colIndex];
        if (row.mismatches[colIndex] && row.status === 'matched') {
          exportRow[`${header}_REF`] = row.referenceData?.[colIndex];
        }
      });
      return exportRow;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparison Results");
    XLSX.writeFile(wb, "comparison_results.xlsx");
  };

  const handleExportText = () => {
    if (!result || !mainData || !refData) return;
    const report = generateTextReport(mainData, refData, result, keyColumns);
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'comparison_summary.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <FileSearch size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">File Comparator</h1>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] -mt-1">Data Verification Tool</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {result && (
              <>
                <button
                  onClick={handleExportText}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition-all active:scale-95"
                  title="Download AI Text Summary"
                >
                  <FileText size={16} />
                  <span>AI Report</span>
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all active:scale-95"
                >
                  <Download size={16} />
                  <span>Export Excel</span>
                </button>
              </>
            )}
            <button
              onClick={handleReset}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              title="Reset"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div 
              key="upload-section"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-4xl mx-auto flex flex-col gap-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-slate-900">Compare your datasets</h2>
                <p className="text-slate-500">Upload two files to identify discrepancies and verify data integrity.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FileUpload 
                  label="Main File (Target)" 
                  selectedFile={mainFile}
                  onFileSelect={handleMainFileSelect}
                  className="h-full"
                />
                <FileUpload 
                  label="Reference File (Source of Truth)" 
                  selectedFile={refFile}
                  onFileSelect={handleRefFileSelect}
                  className="h-full"
                />
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-start gap-3 text-rose-700"
                >
                  <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                  <div className="text-sm font-medium">{error}</div>
                </motion.div>
              )}

              <div className="bg-indigo-50/50 border border-indigo-100 p-6 rounded-3xl flex flex-col gap-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                    <Info size={24} />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-sm font-bold text-slate-900">How it works</h3>
                    <p className="text-xs text-slate-600 leading-relaxed mt-1">
                      The tool compares the Main File against the Reference File. 
                      Select a <strong>Primary Key</strong> (e.g., Employee ID) to match records even if they are in different positions.
                      If no key is selected, it compares row by row.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Match Records By (Primary Key - Select one or more)</label>
                    <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto p-3 bg-white border border-slate-200 rounded-xl">
                      {commonHeaders.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No common columns found between files.</p>
                      ) : (
                        commonHeaders.map(header => (
                          <button
                            key={header}
                            onClick={() => {
                              setKeyColumns(prev => 
                                prev.includes(header) 
                                  ? prev.filter(h => h !== header) 
                                  : [...prev, header]
                              );
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                              keyColumns.includes(header)
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100"
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300"
                            }`}
                          >
                            {header}
                          </button>
                        ))
                      )}
                    </div>
                    {keyColumns.length > 0 && (
                      <p className="text-[10px] text-indigo-600 font-medium">
                        Selected: {keyColumns.join(' & ')}
                      </p>
                    )}
                  </div>

                  <button
                    disabled={!mainData || !refData || isLoading}
                    onClick={handleCompare}
                    className="w-full px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-xl shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex flex-col items-center justify-center gap-1"
                  >
                    {isLoading ? (
                      <>
                        <div className="flex items-center gap-2">
                          <RefreshCw size={20} className="animate-spin" />
                          <span>Processing... {progress}%</span>
                        </div>
                        <div className="w-full max-w-[200px] h-1 bg-white/20 rounded-full overflow-hidden mt-1">
                          <motion.div 
                            className="h-full bg-white" 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>Run Comparison</span>
                        <FileSearch size={20} />
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="result-section"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Comparison Results</h2>
                  <p className="text-slate-500 text-sm">Reviewing discrepancies between <span className="font-semibold text-slate-700">{mainFile?.name}</span> and <span className="font-semibold text-slate-700">{refFile?.name}</span></p>
                </div>
                <button
                  onClick={handleReset}
                  className="px-5 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all flex items-center gap-2 shadow-sm active:scale-95"
                >
                  <RefreshCw size={18} />
                  <span>Start New Comparison</span>
                </button>
              </div>
              
              {result.duplicateKeysInRef > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-3 text-amber-700"
                >
                  <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-bold">Duplicate Keys Detected</p>
                    <p className="text-xs opacity-80">Found {result.duplicateKeysInRef} records with non-unique keys in the reference file. The tool will match against the last occurrence of each key. Consider adding more columns to the unique key for better accuracy.</p>
                  </div>
                </motion.div>
              )}
              
              <ComparisonTable result={result} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs text-slate-400 font-medium tracking-widest uppercase">
            Built with precision & care • 2024
          </p>
        </div>
      </footer>
    </div>
  );
}
