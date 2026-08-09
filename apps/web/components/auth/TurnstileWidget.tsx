'use client';

import React, { useEffect, useId, useRef } from 'react';

/**
 * The Cloudflare Turnstile checkbox.
 *
 * Rendered explicitly rather than by letting the script auto-scan the page.
 * Auto-render binds to whatever `.cf-turnstile` elements exist when the script
 * finishes loading, which in an App Router client component is a race: the
 * script is shared across route changes and the div arrives and leaves with
 * navigation. Explicit render owns the lifecycle — one widget per mount, torn
 * down on unmount.
 */

const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      action?: string;
      theme?: 'auto' | 'light' | 'dark';
      language?: string;
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    },
  ) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    onloadTurnstileCallback?: () => void;
  }
}

/** Resolves once the API object exists, loading the script on first use. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === 'undefined') return new Promise(() => undefined);
  if (window.turnstile) return Promise.resolve(window.turnstile);

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
  const script =
    existing ??
    (() => {
      const el = document.createElement('script');
      el.src = SCRIPT_SRC;
      el.async = true;
      el.defer = true;
      document.head.appendChild(el);
      return el;
    })();

  return new Promise<TurnstileApi>((resolve, reject) => {
    // `load` can fire before `window.turnstile` is assigned, and a second
    // component mounting later must not attach a duplicate script tag.
    const settle = () => {
      if (window.turnstile) resolve(window.turnstile);
      else setTimeout(settle, 50);
    };
    script.addEventListener('load', settle, { once: true });
    script.addEventListener('error', () => reject(new Error('turnstile script failed')), {
      once: true,
    });
    if (window.turnstile) settle();
  });
}

export interface TurnstileHandle {
  /**
   * Discard the current token and draw a fresh challenge.
   *
   * Tokens are redeemed exactly once. After a rejected submit the browser still
   * holds the spent token, and resubmitting it earns `timeout-or-duplicate` —
   * which a user experiences as "it says wrong password, and now it will not
   * let me try again".
   */
  reset: () => void;
}

export function TurnstileWidget({
  onToken,
  handleRef,
}: {
  onToken: (token: string | null) => void;
  handleRef?: React.MutableRefObject<TurnstileHandle | null>;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const domId = useId();

  // Held in a ref so the effect below can stay mounted for the life of the
  // component: re-running it on every parent render would tear down and redraw
  // the challenge mid-interaction.
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const el = containerRef.current;
    if (!siteKey || !el) return;

    let cancelled = false;

    void loadTurnstile()
      .then((api) => {
        if (cancelled || !containerRef.current) return;
        widgetIdRef.current = api.render(containerRef.current, {
          sitekey: siteKey,
          // Telemetry marker for the Spin integration. Removing it does not
          // break verification; it only loses the attribution.
          action: 'turnstile-spin-v2',
          theme: 'auto',
          language: 'vi',
          callback: (token) => onTokenRef.current(token),
          // A token has a lifetime. If the visitor fills the form slowly the
          // token can expire before submit, and sending an expired one reads
          // to the server exactly like a forged one.
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        });

        if (handleRef) {
          handleRef.current = {
            reset: () => {
              onTokenRef.current(null);
              window.turnstile?.reset(widgetIdRef.current ?? undefined);
            },
          };
        }
      })
      .catch(() => {
        // Script blocked by a network filter or an extension. Leave the token
        // null: the server decides, and it fails closed.
        onTokenRef.current(null);
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current) window.turnstile?.remove(widgetIdRef.current);
      widgetIdRef.current = null;
      if (handleRef) handleRef.current = null;
    };
  }, [handleRef]);

  // Nothing to draw when the site key is absent — a local checkout without the
  // variable set still gets a working form, and the server is what enforces.
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return null;

  return (
    <div
      id={domId}
      ref={containerRef}
      className="cf-turnstile"
      data-action="turnstile-spin-v2"
      style={{ display: 'flex', justifyContent: 'center', minHeight: 65 }}
    />
  );
}
