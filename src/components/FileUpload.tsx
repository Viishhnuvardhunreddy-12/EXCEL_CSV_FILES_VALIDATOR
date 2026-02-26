import React, { useCallback, useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FileUploadProps {
  label: string;
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  error?: string;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ label, onFileSelect, selectedFile, error, className }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onFileSelect(files[0]);
    }
  }, [onFileSelect]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  }, [onFileSelect]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label className="text-sm font-semibold text-slate-700 uppercase tracking-wider">{label}</label>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer",
          isDragging ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50",
          selectedFile ? "border-emerald-200 bg-emerald-50/30" : ""
        )}
      >
        <input
          type="file"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={handleFileChange}
          accept=".csv, .xlsx, .xls"
        />
        
        {selectedFile ? (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-2 text-center"
          >
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-2">
              <CheckCircle size={24} />
            </div>
            <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{selectedFile.name}</p>
            <p className="text-xs text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-2">
              <Upload size={24} />
            </div>
            <p className="text-sm font-medium text-slate-600">Click or drag to upload</p>
            <p className="text-xs text-slate-400">Supports .CSV, .XLSX, .XLS</p>
          </div>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-rose-500 mt-1">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
