import { useMutation } from '@tanstack/react-query';

import { api } from '@/lib/api';

/**
 * The password endpoints (P1.02, backend auth.routes.ts). Forgot and reset work without a session; change
 * needs one. None of them retries by itself.
 */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => api.post('/auth/password/forgot', { email }, { auth: false }),
    retry: false,
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: { token: string; new_password: string }) =>
      api.post('/auth/password/reset', body, { auth: false }),
    retry: false,
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) =>
      api.post('/auth/password/change', body),
    retry: false,
  });
}
