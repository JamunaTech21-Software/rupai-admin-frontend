/**
 * The error helpers a screen may use (pages may not import the API client itself): what kind of failure it is,
 * what to say, and the reference to quote.
 */
export {
  ApiError,
  type ApiErrorDetail,
  describeError,
  type ErrorBehaviour,
  errorBehaviour,
  isApiError,
} from './api';
