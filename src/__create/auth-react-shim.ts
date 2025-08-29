// Lightweight production shim for @auth/create/react when deploying as a static SPA.
// Exposes minimal-compatible APIs used by the app without performing any network calls.

import type React from 'react';

type Session = {
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
  } | null;
  expires?: string;
} | null;

export function useSession(): { data: Session; status: 'unauthenticated' | 'loading' | 'authenticated' } {
  return { data: null, status: 'unauthenticated' };
}

export async function signIn(): Promise<void> {
  // no-op in static SPA
}

export async function signOut(): Promise<void> {
  // no-op in static SPA
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return children as React.ReactElement;
}

