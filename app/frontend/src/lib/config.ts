// Runtime configuration
let runtimeConfig: {
  API_BASE_URL: string;
} | null = null;

// Configuration loading state
let configLoading = true;

function isDolliDeployedHost(hostname: string): boolean {
  return (
    hostname === 'staging.dolli.space' ||
    hostname === 'dolli.space' ||
    hostname === 'www.dolli.space'
  );
}

function inferApiBaseURLFromHost(): string {
  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:8000';
  }

  const { protocol, hostname } = window.location;

  // Prod + staging: same origin — nginx proxies /api/ to the backend (see deploy/nginx/).
  // Avoids cross-subdomain CORS and WebKit/Safari TLS/HTTP2 quirks to api*.dolli.space.
  if (
    hostname === 'dolli.space' ||
    hostname === 'www.dolli.space' ||
    hostname === 'staging.dolli.space'
  ) {
    return `${protocol}//${hostname}`;
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://127.0.0.1:8000';
  }

  // Generic fallback for custom preview domains
  if (!hostname.startsWith('api.')) {
    return `${protocol}//api.${hostname}`;
  }

  return `${protocol}//${hostname}`;
}

// Default fallback configuration
const defaultConfig = {
  API_BASE_URL: inferApiBaseURLFromHost(),
};

// Function to load runtime configuration
export async function loadRuntimeConfig(): Promise<void> {
  try {
    console.log('🔧 DEBUG: Starting to load runtime config...');
    // Try to load configuration from a config endpoint
    const response = await fetch('/api/config');
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      // Only parse as JSON if the response is actually JSON
      if (contentType && contentType.includes('application/json')) {
        runtimeConfig = await response.json();
        console.log('Runtime config loaded successfully');
      } else {
        console.log(
          'Config endpoint returned non-JSON response, skipping runtime config'
        );
      }
    } else {
      console.log(
        '🔧 DEBUG: Config fetch failed with status:',
        response.status
      );
    }
  } catch (error) {
    console.log('Failed to load runtime config, using defaults:', error);
  } finally {
    configLoading = false;
    console.log(
      '🔧 DEBUG: Config loading finished, configLoading set to false'
    );
  }
}

function resolveApiBaseURL(): string {
  // On real Dolli hosts, never trust /api/config or build-time VITE_* if they point at the wrong API
  // (misconfigured server env caused staging to call localhost → axios "Network Error").
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (isDolliDeployedHost(host)) {
      return inferApiBaseURLFromHost();
    }
  }

  if (configLoading) {
    return defaultConfig.API_BASE_URL;
  }

  if (runtimeConfig?.API_BASE_URL) {
    return runtimeConfig.API_BASE_URL;
  }

  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL as string;
  }

  return defaultConfig.API_BASE_URL;
}

// Get current configuration
export function getConfig() {
  return {
    get API_BASE_URL() {
      return resolveApiBaseURL();
    },
  };
}

export function getAPIBaseURL(): string {
  return resolveApiBaseURL();
}

// For backward compatibility, but this should be avoided
// Removed static export to prevent using stale config values
// export const API_BASE_URL = getAPIBaseURL();

export const config = {
  get API_BASE_URL() {
    return getAPIBaseURL();
  },
};
