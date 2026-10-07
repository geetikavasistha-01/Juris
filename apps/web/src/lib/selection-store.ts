import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

export type ReadingLevel = 'simple' | 'standard' | 'expert';

export interface VisualCrossFilterState {
  category: string | null;
  period: string | null;
  department: string | null;
  factId: string | null;
  includeEstimates: boolean;
  readingLevel: ReadingLevel;
  setCategory: (category: string | null) => void;
  setPeriod: (period: string | null) => void;
  setDepartment: (department: string | null) => void;
  setFactId: (factId: string | null) => void;
  setIncludeEstimates: (include: boolean) => void;
  setReadingLevel: (level: ReadingLevel) => void;
  resetFilters: () => void;
}

/**
 * Hook providing URL-synced cross-filter state across all visuals, timeline, and facts table (PRD Section 6.4).
 */
export function useVisualSelection(): VisualCrossFilterState {
  const [searchParams, setSearchParams] = useSearchParams();

  const category = searchParams.get('category');
  const period = searchParams.get('period');
  const department = searchParams.get('dept');
  const factId = searchParams.get('fact');
  const includeEstimates = searchParams.get('estimates') === 'true';
  const readingLevel = (searchParams.get('level') as ReadingLevel) || 'standard';

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (
            value === null ||
            value === '' ||
            (key === 'estimates' && value === 'false') ||
            (key === 'level' && value === 'standard')
          ) {
            next.delete(key);
          } else {
            next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setCategory = useCallback(
    (val: string | null) => updateParam('category', val),
    [updateParam],
  );
  const setPeriod = useCallback((val: string | null) => updateParam('period', val), [updateParam]);
  const setDepartment = useCallback(
    (val: string | null) => updateParam('dept', val),
    [updateParam],
  );
  const setFactId = useCallback((val: string | null) => updateParam('fact', val), [updateParam]);
  const setIncludeEstimates = useCallback(
    (include: boolean) => updateParam('estimates', include ? 'true' : null),
    [updateParam],
  );
  const setReadingLevel = useCallback(
    (level: ReadingLevel) => updateParam('level', level),
    [updateParam],
  );

  const resetFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('category');
        next.delete('period');
        next.delete('dept');
        next.delete('fact');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  return useMemo(
    () => ({
      category,
      period,
      department,
      factId,
      includeEstimates,
      readingLevel,
      setCategory,
      setPeriod,
      setDepartment,
      setFactId,
      setIncludeEstimates,
      setReadingLevel,
      resetFilters,
    }),
    [
      category,
      period,
      department,
      factId,
      includeEstimates,
      readingLevel,
      setCategory,
      setPeriod,
      setDepartment,
      setFactId,
      setIncludeEstimates,
      setReadingLevel,
      resetFilters,
    ],
  );
}
