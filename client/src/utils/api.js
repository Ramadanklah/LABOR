// Frontend API utility with optimizations
class APIClient {
  constructor() {
    this.baseURL = '/api';
    this.cache = new Map();
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.pendingRequests = new Map(); // For request deduplication
    this.defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
      },
    };
    this.cacheConfig = {
      defaultTTL: 300000, // 5 minutes
      maxSize: 100, // Maximum cache entries
    };
  }

  // Request interceptor for adding auth token
  addRequestInterceptor(interceptor) {
    this.requestInterceptors.push(interceptor);
  }

  // Response interceptor for error handling
  addResponseInterceptor(interceptor) {
    this.responseInterceptors.push(interceptor);
  }

  // Apply request interceptors
  async applyRequestInterceptors(url, options) {
    let modifiedOptions = { ...options };
    for (const interceptor of this.requestInterceptors) {
      modifiedOptions = await interceptor(url, modifiedOptions);
    }
    return modifiedOptions;
  }

  // Apply response interceptors
  async applyResponseInterceptors(response) {
    let modifiedResponse = response;
    for (const interceptor of this.responseInterceptors) {
      modifiedResponse = await interceptor(modifiedResponse);
    }
    return modifiedResponse;
  }

  // Cache key generator with better hashing
  getCacheKey(url, options) {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : '';
    const params = options.params ? JSON.stringify(options.params) : '';
    return `${method}-${url}-${body}-${params}`;
  }

  // Request deduplication
  async deduplicateRequest(cacheKey, requestFn) {
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }

    const promise = requestFn();
    this.pendingRequests.set(cacheKey, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  // Optimized cache management
  setCache(key, data, ttl = this.cacheConfig.defaultTTL) {
    // Implement LRU cache eviction
    if (this.cache.size >= this.cacheConfig.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  getCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > cached.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  // Retry logic with exponential backoff and jitter
  async retry(fn, retries = 3, delay = 1000) {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0 && error.status >= 500) {
        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 100;
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
        return this.retry(fn, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  // Main request method with optimizations
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const mergedOptions = {
      ...this.defaultOptions,
      ...options,
      headers: {
        ...this.defaultOptions.headers,
        ...options.headers,
      },
    };

    // Apply request interceptors
    const finalOptions = await this.applyRequestInterceptors(url, mergedOptions);

    // Check cache for GET requests
    const cacheKey = this.getCacheKey(url, finalOptions);
    if (finalOptions.method === 'GET' || !finalOptions.method) {
      const cached = this.getCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Make request with deduplication and retry logic
    const makeRequest = async () => {
      const response = await fetch(url, finalOptions);
      
      if (!response.ok) {
        // Try to get the error message from the response body
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          // If we can't parse JSON, use the status text
          errorMessage = response.statusText || errorMessage;
        }
        
        const error = new Error(errorMessage);
        error.status = response.status;
        error.response = response;
        throw error;
      }

      return response;
    };

    const response = await this.deduplicateRequest(cacheKey, () => 
      this.retry(makeRequest)
    );
    const processedResponse = await this.applyResponseInterceptors(response);
    
    // Parse response
    let data;
    const contentType = processedResponse.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await processedResponse.json();
    } else {
      data = await processedResponse.text();
    }

    // Cache GET requests with configurable TTL
    if (finalOptions.method === 'GET' || !finalOptions.method) {
      const ttl = finalOptions.cacheTimeout || this.cacheConfig.defaultTTL;
      this.setCache(cacheKey, data, ttl);
    }

    return data;
  }

  // HTTP method shortcuts
  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  // Download with progress tracking and optimization
  async download(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const finalOptions = await this.applyRequestInterceptors(url, {
      ...this.defaultOptions,
      ...options,
    });

    const response = await fetch(url, finalOptions);
    
    if (!response.ok) {
      const error = new Error(`Download failed: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return response;
  }

  // Clear cache with selective clearing
  clearCache(pattern = null) {
    if (pattern) {
      // Clear specific cache entries matching pattern
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }

  // Clear specific cache entry
  clearCacheEntry(endpoint, options = {}) {
    const cacheKey = this.getCacheKey(`${this.baseURL}${endpoint}`, options);
    this.cache.delete(cacheKey);
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.cacheConfig.maxSize,
      pendingRequests: this.pendingRequests.size,
    };
  }
}

// Create singleton instance
const apiClient = new APIClient();

// Add default auth interceptor
apiClient.addRequestInterceptor(async (url, options) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    options.headers.Authorization = `Bearer ${token}`;
  }
  return options;
});

// Add response error interceptor
apiClient.addResponseInterceptor(async (response) => {
  if (response.status === 401) {
    // Token expired, redirect to login
    localStorage.removeItem('authToken');
    window.location.href = '/login';
  }
  return response;
});

export default apiClient;