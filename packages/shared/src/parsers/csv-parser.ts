import { UPLOAD_LIMITS } from '../modality.js';

export type InferredColumnType = 'number' | 'currency' | 'percentage' | 'date' | 'string';

export interface TableColumn {
  name: string;
  inferredType: InferredColumnType;
  index: number;
}

export interface TableData {
  headers: string[];
  columns: TableColumn[];
  rows: Array<Array<string | number | boolean | null>>;
  rowCount: number;
  columnCount: number;
}

export interface ParseCsvOptions {
  maxRows?: number;
  maxColumns?: number;
}

/**
 * Infers data type of a sample array of column string values
 */
export function inferColumnType(values: string[]): InferredColumnType {
  const cleanValues = values
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && v.toLowerCase() !== 'n/a' && v.toLowerCase() !== 'null');

  if (cleanValues.length === 0) return 'string';

  const currencyRegex = /^[$€£₹¥]?\s*[-+]?[0-9,]+(?:\.[0-9]+)?\s*[$€£₹¥]?$/;
  const percentageRegex = /^[-+]?[0-9]+(?:\.[0-9]+)?%$/;
  const numberRegex = /^[-+]?[0-9,]+(?:\.[0-9]+)?$/;
  const dateRegex = /^\d{4}[-/]\d{2}[-/]\d{2}$/;

  let isCurrency = true;
  let isPercentage = true;
  let isNumber = true;
  let isDate = true;

  for (const val of cleanValues) {
    if (
      !currencyRegex.test(val) ||
      (!val.includes('$') && !val.includes('€') && !val.includes('₹') && !val.includes('£'))
    ) {
      isCurrency = false;
    }
    if (!percentageRegex.test(val)) {
      isPercentage = false;
    }
    if (!numberRegex.test(val.replace(/,/g, ''))) {
      isNumber = false;
    }
    if (!dateRegex.test(val) || Number.isNaN(Date.parse(val))) {
      isDate = false;
    }
  }

  if (isCurrency) return 'currency';
  if (isPercentage) return 'percentage';
  if (isNumber) return 'number';
  if (isDate) return 'date';

  return 'string';
}

/**
 * Safely parses raw CSV text into structured TableData
 */
export function parseCsvTable(rawCsv: string, options: ParseCsvOptions = {}): TableData {
  const maxRows = options.maxRows ?? UPLOAD_LIMITS.maxTableRows;
  const maxColumns = options.maxColumns ?? UPLOAD_LIMITS.maxTableColumns;

  const lines = rawCsv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      headers: [],
      columns: [],
      rows: [],
      rowCount: 0,
      columnCount: 0,
    };
  }

  // Parse header line
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ''));
    return result;
  };

  const headers = parseLine(lines[0] || '');

  if (headers.length > maxColumns) {
    const err = new Error(
      `TABLE_LIMIT_EXCEEDED: Column count ${headers.length} exceeds maximum limit of ${maxColumns}.`,
    );
    (err as unknown as { code: string }).code = 'TABLE_LIMIT_EXCEEDED';
    throw err;
  }

  const rawRows = lines.slice(1, maxRows + 1).map(parseLine);

  if (lines.length - 1 > maxRows) {
    const err = new Error(
      `TABLE_LIMIT_EXCEEDED: Row count ${lines.length - 1} exceeds maximum limit of ${maxRows}.`,
    );
    (err as unknown as { code: string }).code = 'TABLE_LIMIT_EXCEEDED';
    throw err;
  }

  // Infer column types from row samples
  const columns: TableColumn[] = headers.map((header, colIdx) => {
    const colValues = rawRows.map((r) => r[colIdx] || '');
    return {
      name: header,
      index: colIdx,
      inferredType: inferColumnType(colValues),
    };
  });

  // Convert row values according to inferred column types
  const typedRows = rawRows.map((row) =>
    row.map((cellStr, colIdx) => {
      const col = columns[colIdx];
      if (!cellStr || cellStr.toLowerCase() === 'null' || cellStr.toLowerCase() === 'n/a') {
        return null;
      }
      if (col?.inferredType === 'number' || col?.inferredType === 'currency') {
        const num = Number.parseFloat(cellStr.replace(/[^0-9.-]/g, ''));
        return Number.isNaN(num) ? cellStr : num;
      }
      if (col?.inferredType === 'percentage') {
        return cellStr;
      }
      return cellStr;
    }),
  );

  return {
    headers,
    columns,
    rows: typedRows,
    rowCount: typedRows.length,
    columnCount: headers.length,
  };
}
