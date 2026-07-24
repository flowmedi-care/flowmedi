"use client";

import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    grecaptcha?: {
      render: (
        container: HTMLElement,
        params: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => number;
      reset: (widgetId?: number) => void;
      ready: (cb: () => void) => void;
    };
    __flowmedRecaptchaOnLoad?: () => void;
  }
}

const SCRIPT_ID = "google-recaptcha-v2";

function loadRecaptchaScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.grecaptcha) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      window.__flowmedRecaptchaOnLoad = () => resolve();
      if (window.grecaptcha) resolve();
      return;
    }

    window.__flowmedRecaptchaOnLoad = () => resolve();
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src =
      "https://www.google.com/recaptcha/api.js?onload=__flowmedRecaptchaOnLoad&render=explicit";
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Falha ao carregar reCAPTCHA"));
    document.head.appendChild(script);
  });
}

interface RecaptchaV2Props {
  onToken: (token: string | null) => void;
}

export function RecaptchaV2({ onToken }: RecaptchaV2Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  const reset = useCallback(() => {
    if (widgetIdRef.current != null && window.grecaptcha) {
      window.grecaptcha.reset(widgetIdRef.current);
    }
    onToken(null);
  }, [onToken]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let cancelled = false;

    loadRecaptchaScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.grecaptcha) return;
        if (widgetIdRef.current != null) return;

        window.grecaptcha.ready(() => {
          if (cancelled || !containerRef.current || widgetIdRef.current != null) return;
          widgetIdRef.current = window.grecaptcha!.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token) => onToken(token),
            "expired-callback": () => onToken(null),
            "error-callback": () => {
              onToken(null);
              setError("Não foi possível carregar o captcha. Recarregue a página.");
            },
          });
        });
      })
      .catch(() => {
        if (!cancelled) {
          setError("Não foi possível carregar o captcha. Recarregue a página.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [siteKey, onToken]);

  if (!siteKey) {
    return (
      <p className="text-xs text-muted-foreground">
        Captcha não configurado (NEXT_PUBLIC_RECAPTCHA_SITE_KEY).
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground underline"
        onClick={reset}
      >
        Atualizar captcha
      </button>
    </div>
  );
}
