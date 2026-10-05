/**
 * The API layer (F0.06). Features import it in their api/ modules; pages never do (lint rule).
 */
export {
  api,
  type ApiClient,
  type ApiClientOptions,
  type ApiMeta,
  type ApiResponse,
  createApiClient,
  type Method,
  type PagePagination,
  type RequestOptions,
  type ResponseSchema,
} from './client';
export {
  ApiError,
  type ApiErrorDetail,
  ClientContractError,
  type ErrorCode,
  isApiError,
  type KnownErrorCode,
  NetworkError,
  ResponseShapeError,
  toApiError,
} from './errors';
export {
  type AccessToken,
  endSession,
  getAccessToken,
  lastEnvironment,
  onSessionEnd,
  type SessionEndReason,
  setAccessToken,
} from './session';
export { newIdempotencyKey, useIdempotencyKey } from './idempotency';
export { signIn, signOut, TokenSchema, type TokenResponse } from './auth';
export { describeError, type ErrorBehaviour, errorBehaviour } from './behaviour';
