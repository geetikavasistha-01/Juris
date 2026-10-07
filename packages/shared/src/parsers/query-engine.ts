import type { TableData } from './csv-parser.js';
import type { QueryPlan, QueryFilter, QueryAggregate } from '../modality.js';

export interface QueryResult {
  headers: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
  executionTimeMs: number;
}

/**
 * Checks if a table row matches a given QueryFilter
 */
function evaluateFilter(rowObj: Record<string, unknown>, filter: QueryFilter): boolean {
  const val = rowObj[filter.column];

  switch (filter.op) {
    case 'is_null':
      return val === null || val === undefined;
    case 'not_null':
      return val !== null && val !== undefined;
    case 'eq':
      return val === filter.value;
    case 'neq':
      return val !== filter.value;
    case 'gt':
      return typeof val === 'number' && typeof filter.value === 'number' && val > filter.value;
    case 'gte':
      return typeof val === 'number' && typeof filter.value === 'number' && val >= filter.value;
    case 'lt':
      return typeof val === 'number' && typeof filter.value === 'number' && val < filter.value;
    case 'lte':
      return typeof val === 'number' && typeof filter.value === 'number' && val <= filter.value;
    case 'in':
      return Array.isArray(filter.value) && filter.value.includes(val as never);
    case 'contains':
      return (
        typeof val === 'string' &&
        typeof filter.value === 'string' &&
        val.toLowerCase().includes(filter.value.toLowerCase())
      );
    default:
      return true;
  }
}

/**
 * Computes an aggregate function over an array of numeric/scalar values
 */
function computeAggregate(values: unknown[], agg: QueryAggregate): number {
  if (agg.fn === 'count') {
    return values.length;
  }

  if (agg.fn === 'count_distinct') {
    return new Set(values).size;
  }

  const numValues = values
    .map((v) => (typeof v === 'number' ? v : Number.parseFloat(String(v))))
    .filter((n) => !Number.isNaN(n));

  if (numValues.length === 0) return 0;

  switch (agg.fn) {
    case 'sum':
      return numValues.reduce((sum, n) => sum + n, 0);
    case 'avg':
      return numValues.reduce((sum, n) => sum + n, 0) / numValues.length;
    case 'min':
      return Math.min(...numValues);
    case 'max':
      return Math.max(...numValues);
    default:
      return 0;
  }
}

/**
 * Executes a deterministic QueryPlan on a TableData structure (CHT-05)
 */
export function executeQueryPlanOnTable(table: TableData, plan: QueryPlan): QueryResult {
  const startTime = Date.now();

  // Convert row tuples to row records keyed by header
  const rowRecords: Array<Record<string, unknown>> = table.rows.map((row) => {
    const record: Record<string, unknown> = {};
    table.headers.forEach((h, i) => {
      record[h] = row[i];
    });
    return record;
  });

  // 1. Filter rows
  const filtered = rowRecords.filter((row) =>
    plan.filters.every((filter) => evaluateFilter(row, filter)),
  );

  let resultRows: Array<Record<string, string | number | boolean | null>> = [];

  // 2. Group by & Aggregate
  if (plan.groupBy.length > 0) {
    const groups = new Map<string, Array<Record<string, unknown>>>();

    for (const row of filtered) {
      const groupKey = plan.groupBy.map((col) => String(row[col] ?? '')).join(':::');
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(row);
    }

    for (const [, groupRows] of groups) {
      const representative = groupRows[0]!;
      const aggregatedRow: Record<string, string | number | boolean | null> = {};

      // Add group by keys
      for (const col of plan.groupBy) {
        aggregatedRow[col] = representative[col] as string | number | boolean | null;
      }

      // Add aggregates
      for (const agg of plan.aggregates) {
        const values = agg.column ? groupRows.map((r) => r[agg.column!]) : groupRows;
        aggregatedRow[agg.alias] = computeAggregate(values, agg);
      }

      resultRows.push(aggregatedRow);
    }
  } else {
    // No group by: single row aggregate or straight projection
    const singleRow: Record<string, string | number | boolean | null> = {};
    for (const agg of plan.aggregates) {
      const values = agg.column ? filtered.map((r) => r[agg.column!]) : filtered;
      singleRow[agg.alias] = computeAggregate(values, agg);
    }
    resultRows.push(singleRow);
  }

  // 3. Order By
  if (plan.orderBy.length > 0) {
    resultRows.sort((a, b) => {
      for (const order of plan.orderBy) {
        const valA = a[order.key];
        const valB = b[order.key];

        if (valA === valB) continue;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        const cmp = valA > valB ? 1 : -1;
        return order.direction === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
  }

  // 4. Limit
  if (plan.limit && plan.limit > 0) {
    resultRows = resultRows.slice(0, plan.limit);
  }

  const resultHeaders =
    resultRows.length > 0
      ? Object.keys(resultRows[0]!)
      : [...plan.groupBy, ...plan.aggregates.map((a) => a.alias)];

  return {
    headers: resultHeaders,
    rows: resultRows,
    executionTimeMs: Date.now() - startTime,
  };
}
