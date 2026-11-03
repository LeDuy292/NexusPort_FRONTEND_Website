import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

export function useUrlFilters<T extends Record<string, any>>(defaultFilters: T) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const current: Record<string, any> = { ...defaultFilters };
    searchParams.forEach((value, key) => {
      if (key in defaultFilters) {
        const defaultVal = defaultFilters[key];
        if (typeof defaultVal === 'number') {
          current[key] = Number(value);
        } else {
          current[key] = value;
        }
      } else {
        current[key] = value;
      }
    });
    return current as T;
  }, [searchParams, defaultFilters]);

  const setFilter = useCallback(
    (key: keyof T, value: any) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value === undefined || value === null || value === '' || value === 'ALL') {
          next.delete(key as string);
        } else {
          next.set(key as string, String(value));
        }
        // reset to page 1 if changing other filters
        if (key !== 'page' && next.has('page')) {
          next.set('page', '1');
        }
        return next;
      });
    },
    [setSearchParams]
  );

  const resetFilters = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  return { filters, setFilter, resetFilters };
}

