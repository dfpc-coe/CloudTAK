import { test, expect } from '@playwright/test';
import { MapPage } from '../pages/MapPage.ts';

test.describe('Map View', () => {
    test('loads the map view for an authenticated user', async ({ page }) => {
        const map = new MapPage(page);

        await map.goto();
        await map.waitUntilLoaded();

        // The map view stores the current position in the URL hash (e.g. /#4/40/-100)
        await expect(page).toHaveURL(/\/(#[\d./-]+)?$/);
    });
});
