// Performance monitoring and optimization utilities
import React from 'react';

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = new Map();
    this.thresholds = {
      LCP: 2500, // Largest Contentful Paint
      FID: 100,  // First Input Delay
      CLS: 0.1,  // Cumulative Layout Shift
      FCP: 1800, // First Contentful Paint
      TTFB: 800  // Time to First Byte
    };
    
    this.init();
  }

  init() {
    // Initialize performance observers
    this.observeWebVitals();
    this.observeResourceLoading();
    this.observeUserInteractions();
    
    // Log performance data periodically
    setInterval(() => this.logMetrics(), 30000);
  }

  // Observe Core Web Vitals
  observeWebVitals() {
    // Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.recordMetric('LCP', lastEntry.startTime);
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        this.observers.set('LCP', lcpObserver);
      } catch (e) {
        console.warn('LCP observer not supported');
      }

      // First Input Delay
      try {
        const fidObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach(entry => {
            this.recordMetric('FID', entry.processingStart - entry.startTime);
          });
        });
        fidObserver.observe({ type: 'first-input', buffered: true });
        this.observers.set('FID', fidObserver);
      } catch (e) {
        console.warn('FID observer not supported');
      }

      // Cumulative Layout Shift
      try {
        const clsObserver = new PerformanceObserver((entryList) => {
          let clsValue = 0;
          entryList.getEntries().forEach(entry => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          this.recordMetric('CLS', clsValue);
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
        this.observers.set('CLS', clsObserver);
      } catch (e) {
        console.warn('CLS observer not supported');
      }
    }

    // First Contentful Paint
    if (window.performance && window.performance.getEntriesByType) {
      const paintEntries = window.performance.getEntriesByType('paint');
      paintEntries.forEach(entry => {
        if (entry.name === 'first-contentful-paint') {
          this.recordMetric('FCP', entry.startTime);
        }
      });
    }

    // Time to First Byte
    if (window.performance && window.performance.timing) {
      const { responseStart, navigationStart } = window.performance.timing;
      const ttfb = responseStart - navigationStart;
      this.recordMetric('TTFB', ttfb);
    }
  }

  // Observe resource loading performance
  observeResourceLoading() {
    if ('PerformanceObserver' in window) {
      try {
        const resourceObserver = new PerformanceObserver((entryList) => {
          entryList.getEntries().forEach(entry => {
            if (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') {
              this.recordAPIMetric(entry.name, entry.duration);
            } else if (entry.initiatorType === 'script') {
              this.recordResourceMetric('script', entry.duration, entry.transferSize);
            } else if (entry.initiatorType === 'css') {
              this.recordResourceMetric('css', entry.duration, entry.transferSize);
            } else if (entry.initiatorType === 'img') {
              this.recordResourceMetric('image', entry.duration, entry.transferSize);
            }
          });
        });
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.set('resource', resourceObserver);
      } catch (e) {
        console.warn('Resource observer not supported');
      }
    }
  }

  // Observe user interactions
  observeUserInteractions() {
    // Track click response times
    document.addEventListener('click', (event) => {
      const startTime = performance.now();
      requestAnimationFrame(() => {
        const responseTime = performance.now() - startTime;
        this.recordMetric('click_response', responseTime);
      });
    });

    // Track scroll performance
    let scrollStartTime;
    document.addEventListener('scroll', () => {
      if (!scrollStartTime) {
        scrollStartTime = performance.now();
      }
    }, { passive: true });

    document.addEventListener('scrollend', () => {
      if (scrollStartTime) {
        const scrollDuration = performance.now() - scrollStartTime;
        this.recordMetric('scroll_duration', scrollDuration);
        scrollStartTime = null;
      }
    }, { passive: true });
  }

  // Record performance metric
  recordMetric(name, value) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    this.metrics.get(name).push({
      value,
      timestamp: Date.now()
    });

    // Check against thresholds
    if (this.thresholds[name] && value > this.thresholds[name]) {
      console.warn(`Performance threshold exceeded for ${name}: ${value}ms (threshold: ${this.thresholds[name]}ms)`);
    }
  }

  // Record API performance metric
  recordAPIMetric(url, duration) {
    this.recordMetric('api_response_time', duration);
    
    if (!this.metrics.has('api_calls')) {
      this.metrics.set('api_calls', new Map());
    }
    
    const apiCalls = this.metrics.get('api_calls');
    if (!apiCalls.has(url)) {
      apiCalls.set(url, []);
    }
    
    apiCalls.get(url).push({
      duration,
      timestamp: Date.now()
    });
  }

  // Record resource loading metric
  recordResourceMetric(type, duration, size) {
    this.recordMetric(`${type}_load_time`, duration);
    
    if (size) {
      this.recordMetric(`${type}_size`, size);
    }
  }

  // Get performance summary
  getPerformanceSummary() {
    const summary = {};
    
    this.metrics.forEach((values, key) => {
      if (Array.isArray(values)) {
        const recentValues = values.slice(-10); // Last 10 measurements
        summary[key] = {
          average: recentValues.reduce((sum, item) => sum + item.value, 0) / recentValues.length,
          latest: recentValues[recentValues.length - 1]?.value,
          count: values.length,
          max: Math.max(...recentValues.map(item => item.value)),
          min: Math.min(...recentValues.map(item => item.value))
        };
      } else if (values instanceof Map) {
        summary[key] = {};
        values.forEach((apiValues, url) => {
          const recentValues = apiValues.slice(-5);
          summary[key][url] = {
            average: recentValues.reduce((sum, item) => sum + item.duration, 0) / recentValues.length,
            count: apiValues.length
          };
        });
      }
    });
    
    return summary;
  }

  // Log performance metrics
  logMetrics() {
    const summary = this.getPerformanceSummary();
    console.group('🚀 Performance Metrics');
    
    // Core Web Vitals
    console.group('📊 Core Web Vitals');
    ['LCP', 'FID', 'CLS', 'FCP', 'TTFB'].forEach(metric => {
      if (summary[metric]) {
        const status = this.getMetricStatus(metric, summary[metric].latest);
        console.log(`${metric}: ${summary[metric].latest?.toFixed(2) || 'N/A'} ${status}`);
      }
    });
    console.groupEnd();

    // API Performance
    if (summary.api_calls && Object.keys(summary.api_calls).length > 0) {
      console.group('🌐 API Performance');
      Object.entries(summary.api_calls).forEach(([url, stats]) => {
        console.log(`${url}: ${stats.average.toFixed(2)}ms avg (${stats.count} calls)`);
      });
      console.groupEnd();
    }

    // Resource Loading
    console.group('📦 Resource Loading');
    ['script', 'css', 'image'].forEach(type => {
      const loadTime = summary[`${type}_load_time`];
      const size = summary[`${type}_size`];
      if (loadTime) {
        console.log(`${type}: ${loadTime.average.toFixed(2)}ms avg load time${size ? `, ${(size.average / 1024).toFixed(2)}KB avg size` : ''}`);
      }
    });
    console.groupEnd();

    console.groupEnd();
  }

  // Get metric status indicator
  getMetricStatus(metric, value) {
    if (!this.thresholds[metric] || value === undefined) return '';
    
    const threshold = this.thresholds[metric];
    if (metric === 'CLS') {
      return value <= 0.1 ? '✅' : value <= 0.25 ? '⚠️' : '❌';
    } else {
      return value <= threshold ? '✅' : value <= threshold * 1.5 ? '⚠️' : '❌';
    }
  }

  // Measure function execution time
  measureFunction(name, fn) {
    return async (...args) => {
      const startTime = performance.now();
      try {
        const result = await fn(...args);
        const duration = performance.now() - startTime;
        this.recordMetric(`function_${name}`, duration);
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        this.recordMetric(`function_${name}_error`, duration);
        throw error;
      }
    };
  }

  // Measure component render time
  measureComponentRender(componentName) {
    return (WrappedComponent) => {
      return class extends React.Component {
        componentDidMount() {
          const endTime = performance.now();
          if (this.startTime) {
            performanceMonitor.recordMetric(`component_${componentName}_mount`, endTime - this.startTime);
          }
        }

        componentDidUpdate() {
          const endTime = performance.now();
          if (this.updateStartTime) {
            performanceMonitor.recordMetric(`component_${componentName}_update`, endTime - this.updateStartTime);
          }
        }

        render() {
          this.startTime = performance.now();
          this.updateStartTime = performance.now();
          return React.createElement(WrappedComponent, this.props);
        }
      };
    };
  }

  // Generate performance report
  generateReport() {
    const summary = this.getPerformanceSummary();
    const report = {
      timestamp: new Date().toISOString(),
      summary,
      recommendations: this.getRecommendations(summary)
    };
    
    return report;
  }

  // Get performance recommendations
  getRecommendations(summary) {
    const recommendations = [];
    
    // Check Core Web Vitals
    if (summary.LCP?.latest > this.thresholds.LCP) {
      recommendations.push('Improve Largest Contentful Paint by optimizing images and critical resources');
    }
    
    if (summary.FID?.latest > this.thresholds.FID) {
      recommendations.push('Reduce First Input Delay by optimizing JavaScript execution');
    }
    
    if (summary.CLS?.latest > this.thresholds.CLS) {
      recommendations.push('Improve Cumulative Layout Shift by setting image dimensions and avoiding dynamic content insertion');
    }

    // Check API performance
    if (summary.api_response_time?.average > 1000) {
      recommendations.push('Optimize API response times - consider caching or backend optimizations');
    }

    // Check resource sizes
    if (summary.script_size?.average > 100000) {
      recommendations.push('Consider code splitting to reduce JavaScript bundle size');
    }

    if (summary.css_size?.average > 50000) {
      recommendations.push('Optimize CSS bundle size and remove unused styles');
    }

    return recommendations;
  }

  // Clean up observers
  cleanup() {
    this.observers.forEach(observer => {
      observer.disconnect();
    });
    this.observers.clear();
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Export utilities
export default performanceMonitor;

export const measureFunction = (name, fn) => performanceMonitor.measureFunction(name, fn);
export const measureComponentRender = (name) => performanceMonitor.measureComponentRender(name);
export const getPerformanceReport = () => performanceMonitor.generateReport();