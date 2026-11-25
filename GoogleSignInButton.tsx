import React, { useEffect, useRef, useState } from 'react';
import { googleClientId, signInWithGoogleIdToken } from './supabase';

type CredentialResponse = { credential?: string };

interface GsiId {
  initialize(config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GsiId } };
  }
}

const SCRIPT_ID = 'google-identity-services';
let gsiPromise: Promise<void> | null = null;

function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiPromise) return gsiPromise;

  gsiPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Could not load Google sign-in.')));
    if (!existing) document.head.appendChild(script);
  });

  return gsiPromise;
}

interface GoogleSignInButtonProps {
  /** Rendered when Google Identity Services is unavailable. */
  fallback: React.ReactNode;
  /** Called when the ID-token exchange fails, so the caller can retry via redirect. */
  onRedirect: () => void;
  onError: (message: string) => void;
}

/**
 * Official Google button backed by Google Identity Services. Signing in this way
 * keeps the user on this origin — Google shows the app name instead of the
 * Supabase project domain used by the hosted OAuth redirect flow.
 */
export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  fallback,
  onRedirect,
  onError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'loading' | 'google' | 'fallback'>('loading');

  const onRedirectRef = useRef(onRedirect);
  onRedirectRef.current = onRedirect;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;

    loadGsi()
      .then(() => {
        if (cancelled) return;
        const gsi = window.google?.accounts?.id;
        const container = containerRef.current;
        if (!gsi || !container) {
          setMode('fallback');
          return;
        }

        gsi.initialize({
          client_id: googleClientId,
          ux_mode: 'popup',
          callback: async (response) => {
            if (!response.credential) {
              onErrorRef.current('Google did not return a credential.');
              return;
            }
            try {
              await signInWithGoogleIdToken(response.credential);
            } catch (error) {
              onErrorRef.current(
                error instanceof Error ? error.message : 'Google sign-in failed.',
              );
              onRedirectRef.current();
            }
          },
        });

        gsi.renderButton(container, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
          logo_alignment: 'left',
          width: 320,
        });

        setMode('google');
      })
      .catch(() => {
        if (!cancelled) setMode('fallback');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (mode === 'fallback') return <>{fallback}</>;

  return (
    <div className="w-full min-h-[44px] flex items-center justify-center">
      <div ref={containerRef} className={mode === 'google' ? '' : 'invisible'} />
    </div>
  );
};
