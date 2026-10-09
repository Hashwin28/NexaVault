export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Global slow-request event helpers for UI status indicators
function notifySlowRequest(isSlow) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nexavault:server-status', { 
      detail: { isWaking: isSlow } 
    }));
  }
}

/**
 * Universal authenticated API fetch wrapper with:
 * - 2.5s slow request detection (cold start indicator)
 * - Safe idempotent GET retries with backoff on 502/503/504
 * - Non-crashing JSON parsing on proxy/gateway error responses
 * - Strict zero-mutation auto-retry safeguard
 */
export async function apiRequest(endpoint, options = {}, retries = 0) {
  const token = localStorage.getItem('nexavault_jwt_token');
  const method = (options.method || 'GET').toUpperCase();
  const isIdempotent = method === 'GET' || method === 'HEAD';

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const config = {
    ...options,
    headers,
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  // Set up 2.5-second timer to detect server cold boot
  let isSlow = false;
  const slowTimer = setTimeout(() => {
    isSlow = true;
    notifySlowRequest(true);
  }, 2500);

  let response;
  try {
    response = await fetch(url, config);
  } catch (networkError) {
    clearTimeout(slowTimer);
    if (isSlow) notifySlowRequest(false);

    // Auto-retry only safe GET requests on network failures (up to 2 times)
    if (isIdempotent && retries < 2) {
      await new Promise((res) => setTimeout(res, (retries + 1) * 1500));
      return apiRequest(endpoint, options, retries + 1);
    }
    throw new Error('Unable to connect to server. Please check your network or try again shortly.');
  } finally {
    clearTimeout(slowTimer);
    if (isSlow) notifySlowRequest(false);
  }

  // Handle server cold boot gateway timeouts (502/503/504) for GET requests
  if (!response.ok && [502, 503, 504].includes(response.status) && isIdempotent && retries < 2) {
    notifySlowRequest(true);
    await new Promise((res) => setTimeout(res, (retries + 1) * 2000));
    notifySlowRequest(false);
    return apiRequest(endpoint, options, retries + 1);
  }

  // Safe response parsing that will not crash if Render/Vercel returns an HTML error page
  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      const text = await response.text();
      if (text.startsWith('{') && text.endsWith('}')) {
        data = JSON.parse(text);
      }
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    let errorMsg = 'An unexpected server error occurred.';
    if (data?.detail) {
      if (typeof data.detail === 'string') {
        errorMsg = data.detail;
      } else if (Array.isArray(data.detail)) {
        errorMsg = data.detail.map((d) => d.msg || JSON.stringify(d)).join(', ');
      } else {
        errorMsg = JSON.stringify(data.detail);
      }
    } else if (response.status === 502 || response.status === 503 || response.status === 504) {
      errorMsg = 'Vault server node is currently resuming from cold start. Please retry in a few seconds.';
    }

    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
