// Frontend API utility with optimizations
class APIClient {
  constructor() {
    this.baseURL = '/api';
    this.cache = new Map();
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
      },
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

  // Cache key generator
  getCacheKey(url, options) {
    return `${options.method || 'GET'}-${url}-${JSON.stringify(options.body || {})}`;
  }

  // Retry logic with exponential backoff
  async retry(fn, retries = 3, delay = 1000) {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0 && error.status >= 500) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.retry(fn, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  // Main request method
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
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < (finalOptions.cacheTimeout || 300000)) {
        return cached.data;
      }
    }

    // Make request with retry logic
    const makeRequest = async () => {
      const response = await fetch(url, finalOptions);
      
      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        error.status = response.status;
        error.response = response;
        throw error;
      }

      return response;
    };

    const response = await this.retry(makeRequest);
    const processedResponse = await this.applyResponseInterceptors(response);
    
    // Parse response
    let data;
    const contentType = processedResponse.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await processedResponse.json();
    } else {
      data = await processedResponse.text();
    }

    // Cache GET requests
    if (finalOptions.method === 'GET' || !finalOptions.method) {
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });
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

  // Download with progress tracking
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

  // Clear cache
  clearCache() {
    this.cache.clear();
  }

  // Clear specific cache entry
  clearCacheEntry(endpoint, options = {}) {
    const cacheKey = this.getCacheKey(`${this.baseURL}${endpoint}`, options);
    this.cache.delete(cacheKey);
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