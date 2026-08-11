/**
 * Typed accessors for the environment variables that configure the QA suite.
 * Values are loaded from qa/.env by playwright.config.ts before any test runs.
 */

function required(name: string): string {
    const value = process.env[name];

    if (!value || !value.trim().length) {
        throw new Error(`Missing required environment variable: ${name} - populate it in qa/.env`);
    }

    return value.trim();
}

export function cloudtakUrl(): string {
    return required('CLOUDTAK_URL').replace(/\/+$/, '');
}

export function cloudtakUsername(): string {
    return required('CLOUDTAK_USERNAME');
}

export function cloudtakPassword(): string {
    return required('CLOUDTAK_PASSWORD');
}
