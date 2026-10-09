/**
 * AarogyaSight / ClimateGuard API Helper
 * Connects frontend dashboard components to Python FastAPI backend at http://127.0.0.1:8002
 */

(function (window) {
  'use strict';

  const DEFAULT_API_BASE = 'http://127.0.0.1:8002';

  /**
   * Get configured API base URL
   */
  function getApiBase() {
    const base = window.CLIMATEGUARD_API_BASE || DEFAULT_API_BASE;
    return base.replace(/\/+$/, '');
  }

  /**
   * Safe fetch wrapper with timeout support via AbortController
   */
  async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
      }
      throw err;
    }
  }

  const ClimateGuardAPI = {
    getBaseUrl: getApiBase,

    /**
     * GET /health
     * Returns backend connection status and model loading state
     */
    async checkHealth() {
      const baseUrl = getApiBase();
      try {
        const response = await fetchWithTimeout(`${baseUrl}/health`, { method: 'GET' }, 5000);
        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          return {
            ok: false,
            status: 'server_error',
            statusCode: response.status,
            model_loaded: false,
            data_status: 'UNKNOWN',
            error: errText || `HTTP ${response.status} ${response.statusText}`
          };
        }
        const data = await response.json();
        return {
          ok: true,
          status: data.status,
          model_loaded: Boolean(data.model_loaded),
          data_status: data.data_status || 'UNKNOWN',
          error: data.error || null,
          raw: data
        };
      } catch (err) {
        return {
          ok: false,
          status: 'offline',
          model_loaded: false,
          data_status: 'UNREACHABLE',
          error: err.message || 'Cannot reach backend service at ' + baseUrl
        };
      }
    },

    /**
     * GET /
     * Root greeting endpoint
     */
    async getHome() {
      const baseUrl = getApiBase();
      try {
        const response = await fetchWithTimeout(`${baseUrl}/`, { method: 'GET' }, 5000);
        if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
        const data = await response.json();
        return { ok: true, data };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },

    /**
     * POST /predict
     * Map required fields:
     * - cases_previous_week (float >= 0)
     * - cases_3week_average (float >= 0)
     * - rain_previous_week (float >= 0)
     * - temperature_previous_week (float)
     * - humidity_previous_week (float 0..100)
     * - ndvi (float -1..1)
     * - surface_water_index (float 0..1)
     */
    async predict(params) {
      const baseUrl = getApiBase();

      const requiredFields = [
        'cases_previous_week',
        'cases_3week_average',
        'rain_previous_week',
        'temperature_previous_week',
        'humidity_previous_week',
        'ndvi',
        'surface_water_index'
      ];

      const payload = {};
      for (const field of requiredFields) {
        if (params[field] === undefined || params[field] === null || params[field] === '') {
          return { ok: false, error: `Missing required field: ${field}` };
        }
        const val = Number(params[field]);
        if (isNaN(val)) {
          return { ok: false, error: `Field '${field}' must be a valid number` };
        }
        payload[field] = val;
      }

      // Range validations matching pydantic schema
      if (payload.cases_previous_week < 0) return { ok: false, error: 'cases_previous_week must be >= 0' };
      if (payload.cases_3week_average < 0) return { ok: false, error: 'cases_3week_average must be >= 0' };
      if (payload.rain_previous_week < 0) return { ok: false, error: 'rain_previous_week must be >= 0' };
      if (payload.humidity_previous_week < 0 || payload.humidity_previous_week > 100) {
        return { ok: false, error: 'humidity_previous_week must be between 0 and 100' };
      }
      if (payload.ndvi < -1 || payload.ndvi > 1) {
        return { ok: false, error: 'ndvi must be between -1.0 and 1.0' };
      }
      if (payload.surface_water_index < 0 || payload.surface_water_index > 1) {
        return { ok: false, error: 'surface_water_index must be between 0.0 and 1.0' };
      }

      try {
        const response = await fetchWithTimeout(`${baseUrl}/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }, 10000);

        if (!response.ok) {
          let errorMsg = `HTTP Error ${response.status}`;
          try {
            const errBody = await response.json();
            if (errBody && errBody.detail) {
              errorMsg = typeof errBody.detail === 'string' ? errBody.detail : JSON.stringify(errBody.detail);
            }
          } catch (e) {
            const txt = await response.text().catch(() => '');
            if (txt) errorMsg = txt;
          }

          if (response.status === 503) {
            errorMsg = 'Model is unavailable on backend. Please check backend /health status.';
          } else if (response.status === 422) {
            errorMsg = `Validation error from model server: ${errorMsg}`;
          }

          return {
            ok: false,
            statusCode: response.status,
            error: errorMsg
          };
        }

        const data = await response.json();
        return {
          ok: true,
          prediction: data.prediction, // 0 or 1
          risk_level: data.risk_level, // "Elevated" or "Lower"
          elevated_probability: data.elevated_probability, // float e.g. 0.295 or null
          data_status: data.data_status,
          warning: data.warning,
          raw: data
        };

      } catch (err) {
        return {
          ok: false,
          error: err.message || 'Failed to connect to backend prediction service at ' + baseUrl
        };
      }
    }
  };

  window.ClimateGuardAPI = ClimateGuardAPI;
})(window);
