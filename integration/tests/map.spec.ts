import { test, expect, skipPermissionsModal } from '../lib/fixtures.ts';
import { MapPage } from '../pages/MapPage.ts';
import { getStoredToken } from '../lib/session.ts';

test.describe('Map: smoke, page shell', () => {
    let map: MapPage;

    test.beforeEach(async ({ page }) => {
        map = new MapPage(page);
        map.startTileTracking();
        await map.goto();
        await map.waitUntilLoaded();
        await skipPermissionsModal(page);
    });

    test('MAP-01 map page loads after login', async ({ page }) => {
        // "Loading Map State" cleared and the MapLibre canvas is visible
        // (both already awaited by waitUntilLoaded in beforeEach).
        await expect(map.canvas.first()).toBeVisible();
        await expect(map.loadingModal).toBeHidden();

        // Tiles rendered, two independent signals:
        // 1. the server delivered at least one basemap tile with HTTP 200 (network, see MapPage.startTileTracking);
        // 2. the MapLibre instance itself reports loaded() and areTilesLoaded(), read through the Pinia map store (see MapPage.state).
        await map.expectTilesLoaded();
        await map.expectMapIdle();

        // The live view matches what the hash says.
        const state = await map.state();
        expect(state, 'MapLibre instance should be reachable via the Pinia store').not.toBeNull();

        // View state lives in the URL hash: #zoom/lat/lng, optionally /bearing/pitch when either is non-zero (hash: true in stores/map.ts).
        await expect(page).toHaveURL(/#-?\d+(\.\d+)?\/-?\d+(\.\d+)?\/-?\d+(\.\d+)?(\/-?\d+(\.\d+)?){0,2}$/);

        // Default view is a server-wide setting: map::center "-100,40" and
        // map::zoom 4 (api/common/defaults.ts), not per-user. If the staging
        // server overrides these, update the expected values here.
        const hash = map.hash();
        expect(hash, 'URL hash should parse as zoom/lat/lng').not.toBeNull();
        expect(hash?.zoom).toBeCloseTo(4, 1);
        expect(hash?.lat).toBeCloseTo(40, 1);
        expect(hash?.lng).toBeCloseTo(-100, 1);

        // Hash and live map state agree.
        expect(state?.zoom).toBeCloseTo(hash?.zoom as number, 1);
        expect(state?.lat).toBeCloseTo(hash?.lat as number, 1);
        expect(state?.lng).toBeCloseTo(hash?.lng as number, 1);
    });

    test('MAP-02 top bar is visible', async () => {
        await expect(map.activeMission).toBeVisible();
        await expect(map.notifications).toBeVisible();
        await expect(map.geometryEditing).toBeVisible();
        await expect(map.openMenu).toBeVisible();
        // No panel is open on a fresh load, so the close control is absent.
        await expect(map.closeMenu).toBeHidden();
    });

    test('MAP-03 left-top navigation stack is visible and enabled', async () => {
        for (const control of [map.search, map.snapToNorth, map.zoomIn, map.zoomOut]) {
            await expect(control).toBeVisible();
            await expect(control).toBeEnabled();
        }
    });

    test('MAP-04 right-side main menu is visible with the default items in order', async () => {
        await expect(map.menubar).toBeVisible();

        const tooltips = await map.menuItems.evaluateAll((items) =>
            items.map((item) => item.querySelector('[title]')?.getAttribute('title') ?? ''));

        expect(tooltips.slice(0, MapPage.DEFAULT_MENU_TOOLTIPS.length))
            .toEqual(MapPage.DEFAULT_MENU_TOOLTIPS);

        for (const tooltip of MapPage.DEFAULT_MENU_TOOLTIPS) {
            await expect(map.menuItem(tooltip)).toBeVisible();
        }

        // Footer controls below the entries.
        await expect(map.applicationSwitcher).toBeVisible();
        await expect(map.returnHome).toBeVisible();
    });

    test('MAP-05 bottom-left user panel is visible with placeholders and no GPS fix', async ({ page }) => {
        await expect(map.gpsPanel).toBeVisible();

        // The panel shows the TAK callsign (mapStore.callsign, from the
        // profile's tak_callsign), not the account name. Verify it is the
        // logged-in user's callsign via the API rather than a hardcoded value.
        const token = await getStoredToken(page);
        expect(token, 'JWT should be stored after login').toBeTruthy();
        const res = await page.request.get('/api/profile', {
            headers: { Authorization: `Bearer ${token}` },
        });
        expect(res.status()).toBe(200);
        const profile = (await res.json()) as { tak_callsign?: string };
        expect(profile.tak_callsign, 'profile should carry a callsign').toBeTruthy();
        await expect(map.callsign).toHaveText(profile.tak_callsign as string);

        // Placeholders while there is no position. Units follow the
        // profile's elevation/speed settings, so match either variant.
        await expect(map.altitude).toHaveText(/^-- (ft|m) MSL$/);
        await expect(map.speed).toHaveText(/^-- (MPH|km\/h|m\/s)$/);
        await expect(map.heading).toHaveText('--°');

        // Headless Chromium has no geolocation permission by default, so thepanel reports no fix.
        await expect(map.accuracy).toHaveText('No Fix');

        // Coordinates row is rendered. Its value follows the cursor when there
        // is no GPS fix ("Cursor Position"), so only presence is asserted here,
        // not "0, 0".
        await expect(map.coordinates).toBeVisible();
        await expect(map.coordinates).not.toHaveText('');

        // Set Your Location control is present.
        await expect(map.setLocation).toBeVisible();
    });

    test('MAP-06 scale bar is visible with a distance and unit', async () => {
        await expect(map.scaleBar).toBeVisible();

        // ScaleControl unit follows the profile's display_distance setting:
        // 'mile' -> imperial (ft / mi), anything else -> metric (m / km).
        // scale() throws on anything it cannot parse, so a successful parse
        // is the format assertion.
        const scale = await map.scale();
        expect(scale.value).toBeGreaterThan(0);
        expect(['ft', 'mi', 'm', 'km']).toContain(scale.unit);

        // At the default zoom 4 over CONUS the bar reads 200 mi (imperial)
        // or its metric counterpart; either way it is in the hundreds of km.
        expect(scale.meters).toBeGreaterThan(100_000);
        expect(scale.meters).toBeLessThan(1_000_000);
    });

    test('MAP-07 version label is valid SemVer', async () => {
        // Assert the label is valid SemVer, not a fixed value
        await expect(map.version).toBeVisible();
        await expect(map.version).toHaveText(
            /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/,
        );
    });

    test('MAP-08 "new version is ready" banner is absent or can be dismissed', async () => {
        // Conditional function where we assert banner if it's present, otherwise assert it is absent.
        const shown = await map.updateBanner.isVisible().catch(() => false);

        if (shown) {
            await map.updateBannerClose.click();
            await expect(map.updateBanner).toBeHidden();
        } else {
            await expect(map.updateBanner).toHaveCount(0);
            await expect(map.updateBannerClose).toHaveCount(0);
        }
    });

    test('MAP-09 Contacts item is visible with or without a count badge', async () => {
        const contacts = map.menuItem('Contacts');
        await expect(contacts).toBeVisible();

        // The badge is the number of online contacts (stores/modules/menu.ts),
        // rendered only when > 0 and capped at "99+". Its presence depends on
        // who else is connected to staging, so tolerate both states but
        // insist on a sane value when it is there.
        const badge = map.menuBadge('Contacts');
        if (await badge.count()) {
            await expect(badge).toBeVisible();
            await expect(badge).toHaveText(/^([1-9]\d?|99\+)$/);
        } else {
            await expect(badge).toHaveCount(0);
        }
    });
});