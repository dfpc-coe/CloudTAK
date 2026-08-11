import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Page Object for the main CloudTAK Map view (/)
 *
 * The map view shows a "Loading Map State" modal while the CoT database,
 * overlays, and MapLibre style are initialized - the view is considered
 * loaded once that modal is gone and the MapLibre canvas is rendered.
 */
export class MapPage {
    readonly page: Page;
    readonly canvas: Locator;
    readonly loadingModal: Locator;

    constructor(page: Page) {
        this.page = page;
        this.canvas = page.locator('.maplibregl-canvas');
        this.loadingModal = page.getByText('Loading Map State');
    }

    async goto(): Promise<void> {
        await this.page.goto('/');
    }

    /**
     * Wait for the full map state load. A remote instance has to hydrate the
     * profile, overlays, and CoT state before the loading modal clears, so
     * this uses a generous timeout.
     */
    async waitUntilLoaded(): Promise<void> {
        await expect(this.canvas.first()).toBeVisible({ timeout: 90_000 });
        await expect(this.loadingModal).toBeHidden({ timeout: 90_000 });
    }
}
