/**
 * Client-side helpers for the allowed senders of a Layer's incoming email -
 * each an address or an `@domain`. Mirrors the validation rules of the API
 */

export const MAX_SENDERS = 25;

export function parseSenders(text: string): string[] {
    const senders = text
        .split(/[\n,]/)
        .map((sender) => sender.trim().toLowerCase())
        .filter((sender) => sender.length);

    return Array.from(new Set(senders));
}

/** Return a human readable error or an empty string if the senders are valid */
export function validateSenders(senders: string[]): string {
    if (senders.length > MAX_SENDERS) return `No more than ${MAX_SENDERS} senders are allowed`;

    for (const sender of senders) {
        if (sender.length > 128 || !/^[^\s@<>]*@[^\s@<>]+$/.test(sender)) {
            return `${sender} is not an address or @domain`;
        }
    }

    return '';
}
