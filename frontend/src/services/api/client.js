import axios from 'axios'
import { API_BASE_URL } from '../../config/env'
import { API_ERROR_CATEGORY, ApiRequestError, toApiRequestError } from './error'

const CSRF_COOKIE_NAME = 'csrftoken'
const CSRF_HEADER_NAME = 'X-CSRFToken'
const CSRF_SAFE_METHODS = new Set(['get', 'head', 'options', 'trace'])

/**
 * The single HTTP client for PashuChara-AI.
 *
 * Feature services import this instance rather than creating their own Axios
 * clients. Authentication-specific request handling belongs in the
 * interceptor below once authentication is introduced.
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15_000,
  headers: {
    Accept: 'application/json',
  },
})

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

// Browsers never expose a cookie to document.cookie unless it belongs to the
// current page's own domain — once the API lives on a different domain than
// the frontend (e.g. the Capacitor app at https://localhost calling a Render
// backend), the csrftoken cookie is invisible to this JS even though the
// browser still attaches it automatically on requests. LoginView/MeView also
// echo the token as an X-CSRFToken response header (exposed cross-origin via
// CORS_EXPOSE_HEADERS) specifically so it can be captured here instead.
let capturedCsrfToken = null

/**
 * Django's session auth only enforces CSRF once a request carries an
 * authenticated session (see backend apps.accounts.views), so the token is
 * only guaranteed to exist after login/me — this attaches it whenever present.
 */
apiClient.interceptors.request.use(
  (config) => {
    const method = (config.method || 'get').toLowerCase()
    if (!CSRF_SAFE_METHODS.has(method)) {
      const token = capturedCsrfToken || readCookie(CSRF_COOKIE_NAME)
      if (token) {
        config.headers[CSRF_HEADER_NAME] = token
      }
    }
    return config
  },
  (error) => Promise.reject(error),
)

apiClient.interceptors.response.use(
  (response) => {
    const contentType = String(response.headers?.['content-type'] || '').toLowerCase()
    const responseType = response.config?.responseType

    // In Capacitor WebView (https://localhost), relative /api/* requests without
    // a reachable backend fallback to serving index.html with HTTP 200. Reject
    // HTML or unexpected string payloads here so callers never treat them as JSON.
    if (responseType === 'blob') {
      if (response.data instanceof Blob && response.data.type.toLowerCase().includes('text/html')) {
        return Promise.reject(
          new ApiRequestError({
            message: 'Unable to reach the backend API. Check your connection or API URL configuration.',
            status: response.status ?? null,
            category: API_ERROR_CATEGORY.NETWORK,
            code: 'ERR_HTML_RESPONSE',
            data: null,
          }),
        )
      }
    } else if (response.status !== 204) {
      const isNonEmptyString = typeof response.data === 'string' && response.data.trim().length > 0
      if (contentType.includes('text/html') || isNonEmptyString) {
        return Promise.reject(
          new ApiRequestError({
            message: 'Unable to reach the backend API. Check your connection or API URL configuration.',
            status: response.status ?? null,
            category: API_ERROR_CATEGORY.NETWORK,
            code: 'ERR_INVALID_RESPONSE',
            data: null,
          }),
        )
      }
    }

    const headerToken = response.headers?.['x-csrftoken']
    if (headerToken) {
      capturedCsrfToken = headerToken
    }
    return response.data
  },
  (error) => Promise.reject(toApiRequestError(error)),
)

export default apiClient
