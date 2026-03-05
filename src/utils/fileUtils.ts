import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface FileData {
  headers: string[];
  rows: any[][];
  fileName: string;
}

export const parseFile = async (file: File): Promise<FileData> => {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        complete: (results) => {
          const rows = results.data as any[][];
          if (rows.length === 0) {
            reject(new Error('Empty file'));
            return;
          }
          const headers = rows[0].map(h => String(h));
          const dataRows = rows.slice(1).filter(row => row.length > 0 && row.some(cell => cell !== ''));
          resolve({ headers, rows: dataRows, fileName: file.name });
        },
        error: (error) => reject(error),
      });
    });
  } else if (extension === 'xlsx' || extension === 'xls') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          
          if (jsonData.length === 0) {
            reject(new Error('Empty file'));
            return;
          }
          
          const headers = jsonData[0].map(h => String(h));
          const dataRows = jsonData.slice(1).filter(row => row.length > 0 && row.some(cell => cell !== ''));
          resolve({ headers, rows: dataRows, fileName: file.name });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  } else {
    throw new Error('Unsupported file format. Please upload CSV or Excel files.');
  }
};

export interface ComparisonResult {
  headers: string[];
  rows: {
    data: any[];
    mismatches: boolean[]; // true if value doesn't match reference
    referenceData?: any[]; // optional reference row
    status: 'matched' | 'not_found_in_reference';
  }[];
  duplicateKeysInRef: number;
}

export const compareFilesAsync = async (
  main: FileData, 
  reference: FileData, 
  keyColumnNames?: string[],
  onProgress?: (progress: number) => void
): Promise<ComparisonResult> => {
  const mainHeaders = main.headers;
  const refHeaders = reference.headers;
  const CHUNK_SIZE = 5000;

  // Normalize reference headers for robust lookup
  const normalizedRefHeaders = refHeaders.map(h => String(h).trim().toLowerCase());
  const getRefColIndex = (name: string) => normalizedRefHeaders.indexOf(name.trim().toLowerCase());

  let refMap = new Map<string, any[]>();
  let duplicateKeysInRef = 0;
  
  const refKeyIndices = keyColumnNames 
    ? keyColumnNames.map(name => getRefColIndex(name)).filter(idx => idx !== -1)
    : [];
  const mainKeyIndices = keyColumnNames 
    ? keyColumnNames.map(name => mainHeaders.indexOf(name)).filter(idx => idx !== -1)
    : [];

  const hasValidKeys = keyColumnNames && keyColumnNames.length > 0 && 
                       refKeyIndices.length === keyColumnNames.length && 
                       mainKeyIndices.length === keyColumnNames.length;

  if (hasValidKeys) {
    for (let i = 0; i < reference.rows.length; i++) {
      const row = reference.rows[i];
      
      // Explicitly build key using string concatenation to avoid any numeric addition
      let key = "";
      for (let j = 0; j < refKeyIndices.length; j++) {
        const val = row[refKeyIndices[j]];
        const strVal = (val === null || val === undefined) ? "" : String(val).trim();
        key += (j > 0 ? ":::[SEP]:::" : "") + strVal;
      }

      if (key) {
        if (refMap.has(key)) {
          duplicateKeysInRef++;
        }
        refMap.set(key, row);
      }
      
      if (i % CHUNK_SIZE === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
        if (onProgress) onProgress(Math.round((i / reference.rows.length) * 20));
      }
    }
  }

  const resultRows: ComparisonResult['rows'] = [];

  for (let i = 0; i < main.rows.length; i++) {
    const mainRow = main.rows[i];
    let refRow: any[] | undefined;
    let status: 'matched' | 'not_found_in_reference' = 'matched';

    if (hasValidKeys) {
      let key = "";
      for (let j = 0; j < mainKeyIndices.length; j++) {
        const val = mainRow[mainKeyIndices[j]];
        const strVal = (val === null || val === undefined) ? "" : String(val).trim();
        key += (j > 0 ? ":::[SEP]:::" : "") + strVal;
      }
      refRow = refMap.get(key);
      if (!refRow) status = 'not_found_in_reference';
    } else {
      refRow = reference.rows[i];
      if (!refRow) status = 'not_found_in_reference';
    }

    const mismatches = mainRow.map((value, colIndex) => {
      const headerName = mainHeaders[colIndex];
      const refColIndex = getRefColIndex(headerName);
      
      // If column doesn't exist in reference file, we don't mark it as a mismatch
      if (refColIndex === -1) {
        return false; 
      }

      if (!refRow) {
        return status === 'not_found_in_reference' ? false : true; 
      }

      const refValue = refRow[refColIndex];
      
      const v1 = value === null || value === undefined ? '' : String(value).trim();
      const v2 = refValue === null || refValue === undefined ? '' : String(refValue).trim();
      
      // Exact match
      if (v1 === v2) return false;
      
      // Case-insensitive match
      if (v1.toLowerCase() === v2.toLowerCase()) return false;

      // Numeric comparison (handle cases like 1.0 vs 1, or currency symbols)
      const cleanNum = (s: string) => s.replace(/[$,]/g, '');
      const n1 = Number(cleanNum(v1));
      const n2 = Number(cleanNum(v2));
      
      if (!isNaN(n1) && !isNaN(n2) && v1 !== '' && v2 !== '') {
        return n1 !== n2;
      }
      
      return true;
    });

    resultRows.push({
      data: mainRow,
      mismatches,
      referenceData: refRow,
      status
    });

    // Yield every CHUNK_SIZE rows during comparison
    if (i % CHUNK_SIZE === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
      if (onProgress) {
        const baseProgress = hasValidKeys ? 20 : 0;
        const currentProgress = Math.round((i / main.rows.length) * (100 - baseProgress));
        onProgress(baseProgress + currentProgress);
      }
    }
  }

  return {
    headers: mainHeaders,
    rows: resultRows,
    duplicateKeysInRef
  };
};

export const generateTextReport = (
  main: FileData,
  reference: FileData,
  result: ComparisonResult,
  keyColumnNames: string[]
): string => {
  let report = `${reference.fileName}\n`;
  report += `==================\n\n`;
  report += `1. total records from both file: Akhilesh file: ${main.rows.length}        Ankith file: ${reference.rows.length}\n\n`;

  const columnMismatches = result.headers.map((header, colIndex) => {
    const count = result.rows.reduce((acc, row) => 
      acc + (row.status === 'matched' && row.mismatches[colIndex] ? 1 : 0), 0
    );
    return { header, count, colIndex };
  });

  columnMismatches.forEach((cm, i) => {
    report += `${i + 2}. ${cm.header} column No.of values miss matched: ${cm.count}\n`;
  });

  report += `\nEXAMPLE ERRORS PER COLUMN:\n`;
  report += `-------------------------\n`;

  columnMismatches.forEach((cm) => {
    if (cm.count > 0) {
      // Find the first mismatch for this column
      const firstErrorRow = result.rows.find(row => row.status === 'matched' && row.mismatches[cm.colIndex]);
      if (firstErrorRow) {
        const mainVal = firstErrorRow.data[cm.colIndex];
        const refVal = firstErrorRow.referenceData?.[cm.colIndex];
        
        report += `\nmiss matched value from the ${cm.header} column is Akhilesh file: ${mainVal}   Ankith file: ${refVal}\n`;
        
        // Add primary keys
        if (keyColumnNames.length > 0) {
          const keyDetails = keyColumnNames.map(keyName => {
            const keyColIdx = result.headers.indexOf(keyName);
            if (keyColIdx !== -1) {
              return `${keyName}:${firstErrorRow.data[keyColIdx]}`;
            }
            return '';
          }).filter(s => s !== '').join('  ');
          
          if (keyDetails) {
            report += `${keyDetails}\n`;
          }
        }
      }
    }
  });

  return report;
};
