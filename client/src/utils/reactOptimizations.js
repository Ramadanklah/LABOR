// React Performance Optimization Utilities

import React, { memo, useMemo, useCallback, useRef, useEffect } from 'react';

// Higher-order component for performance monitoring
export const withPerformanceTracking = (WrappedComponent, componentName) => {
  return memo((props) => {
    const renderCount = useRef(0);
    const startTime = useRef(performance.now());

    useEffect(() => {
      renderCount.current += 1;
      const endTime = performance.now();
      const renderTime = endTime - startTime.current;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`${componentName} rendered ${renderCount.current} times in ${renderTime.toFixed(2)}ms`);
      }
      
      startTime.current = performance.now();
    });

    return <WrappedComponent {...props} />;
  });
};

// Virtualized list component for large datasets
export const VirtualizedList = memo(({ 
  items, 
  itemHeight, 
  containerHeight, 
  renderItem, 
  overscan = 5 
}) => {
  const [scrollTop, setScrollTop] = React.useState(0);
  const containerRef = useRef(null);

  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(
      start + Math.ceil(containerHeight / itemHeight) + overscan,
      items.length
    );
    return { start: Math.max(0, start - overscan), end };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end);
  }, [items, visibleRange]);

  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.start * itemHeight;

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative'
      }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: offsetY,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map((item, index) => (
            <div key={visibleRange.start + index} style={{ height: itemHeight }}>
              {renderItem(item, visibleRange.start + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// Debounced input component
export const DebouncedInput = memo(({ 
  value, 
  onChange, 
  delay = 300, 
  ...props 
}) => {
  const [localValue, setLocalValue] = React.useState(value);
  const timeoutRef = useRef(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, delay);
  }, [onChange, delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <input
      {...props}
      value={localValue}
      onChange={handleChange}
    />
  );
});

// Lazy loading image component
export const LazyImage = memo(({ 
  src, 
  alt, 
  placeholder = '/placeholder.png',
  threshold = 0.1,
  ...props 
}) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isInView, setIsInView] = React.useState(false);
  const imgRef = useRef(null);
  const observerRef = useRef(null);

  useEffect(() => {
    if (!imgRef.current) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observerRef.current?.disconnect();
        }
      },
      { threshold }
    );

    observerRef.current.observe(imgRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [threshold]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  return (
    <img
      ref={imgRef}
      src={isInView ? src : placeholder}
      alt={alt}
      onLoad={handleLoad}
      style={{
        opacity: isLoaded ? 1 : 0.5,
        transition: 'opacity 0.3s ease-in-out',
        ...props.style
      }}
      {...props}
    />
  );
});

// Optimized table component
export const OptimizedTable = memo(({ 
  data, 
  columns, 
  sortBy, 
  sortDirection, 
  onSort,
  pageSize = 20,
  currentPage = 1,
  onPageChange,
  ...props 
}) => {
  const sortedData = useMemo(() => {
    if (!sortBy) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortBy, sortDirection]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = useCallback((column) => {
    if (onSort) {
      const newDirection = sortBy === column && sortDirection === 'asc' ? 'desc' : 'asc';
      onSort(column, newDirection);
    }
  }, [sortBy, sortDirection, onSort]);

  return (
    <div {...props}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort(column.key)}
              >
                {column.label}
                {sortBy === column.key && (
                  <span className="ml-1">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {paginatedData.map((row, index) => (
            <tr key={row.id || index} className="hover:bg-gray-50">
              {columns.map((column) => (
                <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {column.render ? column.render(row[column.key], row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
});

// Performance monitoring hook
export const usePerformanceMonitor = (componentName) => {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(performance.now());

  useEffect(() => {
    renderCount.current += 1;
    const currentTime = performance.now();
    const renderTime = currentTime - lastRenderTime.current;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`${componentName} rendered ${renderCount.current} times in ${renderTime.toFixed(2)}ms`);
    }
    
    lastRenderTime.current = currentTime;
  });

  return {
    renderCount: renderCount.current,
    resetRenderCount: () => { renderCount.current = 0; }
  };
};

// Export all utilities
export default {
  withPerformanceTracking,
  VirtualizedList,
  DebouncedInput,
  LazyImage,
  OptimizedTable,
  usePerformanceMonitor
};