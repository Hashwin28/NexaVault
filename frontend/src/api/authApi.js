import { apiRequest } from './client';

export const authApi = {
  /**
   * Pre-warms the backend and Neon database connection on login page mount
   */
  async prewarm(wakeDb = true) {
    try {
      return await apiRequest(`/health?wake_db=${wakeDb ? 'true' : 'false'}`);
    } catch {
      return null;
    }
  },

  /**
   * Authenticates user with email and password
   */
  async login(email, password) {
    return await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
  },

  /**
   * Registers a new user account
   */
  async register(email, password, fullName, role = 'student') {
    return await apiRequest('/auth/register', {
      method: 'POST',
      body: {
        email,
        password,
        full_name: fullName,
        role,
      },
    });
  },

  /**
   * Fetches profile of currently authenticated user using Bearer JWT
   */
  async getMe(token) {
    return await apiRequest('/auth/me', {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
};
