import { getRuntimeToken, stdurl } from '../../std.ts';

let initialized = false;

/**
 * Window of time during which an identical error message is reported at most
 * once, preventing a faulty render loop or retry storm from flooding the API.
 */
const REPORT_DEDUPE_MS = 10000;
const recentReports = new Map<string, number>();

/**
 * Fire-and-forget report of an error to the backend `/api/error` endpoint.
 *
 * Uses `fetch` with `keepalive: true` rather than `navigator.sendBeacon`:
 * beacons cannot set an `Authorization` header (and our API requires Bearer
 * auth), whereas a keepalive fetch keeps the request alive across page unload
 * while still allowing custom headers.
 */
export function reportError(message: string, trace?: string): void {
    if (!message) return;

    const now = Date.now();
    const last = recentReports.get(message);
    if (last !== undefined && now - last < REPORT_DEDUPE_MS) return;
    recentReports.set(message, now);

    if (recentReports.size > 100) {
        for (const [key, ts] of recentReports) {
            if (now - ts >= REPORT_DEDUPE_MS) recentReports.delete(key);
        }
    }

    void (async () => {
        try {
            const token = await getRuntimeToken();
            if (!token) return;

            await fetch(stdurl('/api/error'), {
                method: 'POST',
                keepalive: true,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    message,
                    ...(trace ? { trace: trace.slice(0, 16000) } : {}),
                }),
            });
        } catch {
            // Reporting must never surface an error to the caller.
        }
    })();
}

/**
 * Register page-level handlers that surface otherwise-uncaught errors to the
 * backend `/api/error` endpoint. Idempotent and safe to call from every app
 * entrypoint.
 */
export function initGlobalErrorReporting(): void {
    if (initialized) return;
    if (typeof window === 'undefined') return;
    initialized = true;

    window.addEventListener('error', (event: ErrorEvent) => {
        // Resource-load failures (img/script/link) surface as ErrorEvents that
        // carry a target element but no `.error`; those are handled separately
        // by the service-worker recovery path and are not application faults.
        if (!event.error && event.target && event.target !== window) return;

        const err = event.error;
        reportError(
            err instanceof Error ? err.message : (event.message || 'Uncaught Error'),
            err instanceof Error ? err.stack : undefined,
        );
    });

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
        const reason = event.reason;
        reportError(
            reason instanceof Error ? reason.message : `Unhandled Rejection: ${String(reason)}`,
            reason instanceof Error ? reason.stack : undefined,
        );
    });
}

/**
 * Vue `app.config.errorHandler` that reports render/lifecycle errors while
 * preserving Vue's default console logging.
 */
export function vueErrorHandler(err: unknown, _instance: unknown, info: string): void {
    const trace = [err instanceof Error ? err.stack : undefined, `Vue Info: ${info}`]
        .filter(Boolean)
        .join('\n');

    reportError(err instanceof Error ? err.message : String(err), trace);

    console.error(err);
}
