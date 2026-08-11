import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { cloudtakUrl } from './lib/env.ts';

const root = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(root, '.env'), quiet: true });

/** Storage state produced by tests/auth.setup.ts and reused by all tests */
export const STORAGE_STATE = path.join(root, '.auth/user.json');

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    timeout: 120_000,
    reporter: [['html', { open: 'never' }], ['list']],
    use: {
        baseURL: cloudtakUrl(),
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
    },
    projects: [
        {
            name: 'setup',
            testMatch: /.*\.setup\.ts/
        },
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                storageState: STORAGE_STATE
            },
            dependencies: ['setup']
        }
    ]
});
