import { isNativePlatform } from './capacitor.ts';

/** Name shown to the user's other sessions while this one broadcasts their location */
export function labelFromUserAgent(ua: string, native: boolean): string {
    if (native) {
        if (/iPad/.test(ua)) return 'iPad (app)';
        if (/iPhone|iPod/.test(ua)) return 'iPhone (app)';
        const model = /Android [\d.]+; ([^;)]+?)(?: Build\/[^;)]*)?[;)]/.exec(ua)?.[1]?.trim();
        // Chrome reports "K" when it hides the model
        if (model && model !== 'K') return `${model} (app)`;
        if (/Android/.test(ua)) return 'Android (app)';
        return 'CloudTAK app';
    }

    // Edge and Opera also claim Chrome, Chrome also claims Safari
    let browser = 'Browser';
    if (/Edg\//.test(ua)) browser = 'Edge';
    else if (/OPR\//.test(ua)) browser = 'Opera';
    else if (/Firefox\//.test(ua) || /FxiOS\//.test(ua)) browser = 'Firefox';
    else if (/Chrome\//.test(ua) || /CriOS\//.test(ua)) browser = 'Chrome';
    else if (/Safari\//.test(ua)) browser = 'Safari';

    let os = '';
    if (/Windows/.test(ua)) os = 'Windows';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
    else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
    else if (/CrOS/.test(ua)) os = 'ChromeOS';
    else if (/Linux/.test(ua)) os = 'Linux';

    return os ? `${browser} on ${os}` : browser;
}

export function sessionLabel(): string {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    return labelFromUserAgent(ua, isNativePlatform());
}
