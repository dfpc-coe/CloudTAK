import { test, expect, skipPermissionsModal } from '../lib/fixtures.ts';
import { MapPage } from '../pages/MapPage.ts';
import { getStoredToken } from '../lib/session.ts';
import { cloudtakUsername } from '../lib/env.ts';

test.describe('Map: smoke, page shell', () => {
    // Tile tracking must start before goto(), so this describe loads the map itself.
    test.beforeEach(async ({ map, page }) => {
        map.startTileTracking();
        await map.goto();
        await map.waitUntilLoaded();
        await skipPermissionsModal(page);
    });

    test('MAP-01 map page loads after login', async ({ map, page }) => {
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

    test('MAP-02 top bar is visible', async ({ map }) => {
        await expect(map.activeMission).toBeVisible();
        await expect(map.notifications).toBeVisible();
        await expect(map.geometryEditing).toBeVisible();
        await expect(map.openMenu).toBeVisible();
        // No panel is open on a fresh load, so the close control is absent.
        await expect(map.closeMenu).toBeHidden();
    });

    test('MAP-03 left-top navigation stack is visible and enabled', async ({ map }) => {
        for (const control of [map.search, map.snapToNorth, map.zoomIn, map.zoomOut]) {
            await expect(control).toBeVisible();
            await expect(control).toBeEnabled();
        }
    });

    test('MAP-04 right-side main menu is visible with the default items in order', async ({ map }) => {
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

    test('MAP-05 bottom-left user panel is visible with placeholders and no GPS fix', async ({ map, page }) => {
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

        // Headless Chromium has no geolocation permission by default, so the panel reports no fix.
        await expect(map.accuracy).toHaveText('No Fix');

        // Coordinates row is rendered. Its value follows the cursor when there
        // is no GPS fix ("Cursor Position"), so only presence is asserted here,
        // not "0, 0".
        await expect(map.coordinates).toBeVisible();
        await expect(map.coordinates).not.toHaveText('');

        // Set Your Location control is present.
        await expect(map.setLocation).toBeVisible();
    });

    test('MAP-06 scale bar is visible with a distance and unit', async ({ map }) => {
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

    test('MAP-07 version label is valid SemVer', async ({ map }) => {
        // Assert the label is valid SemVer, not a fixed value
        await expect(map.version).toBeVisible();
        await expect(map.version).toHaveText(
            /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/,
        );
    });

    test('MAP-08 "new version is ready" banner is absent or can be dismissed', async ({ map }) => {
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

    test('MAP-09 Contacts item is visible with or without a count badge', async ({ map }) => {
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

test.describe('Map: zoom and scale bar', () => {
    test('MAP-10 Zoom In button zooms one level and shrinks the scale', async ({ readyMap: map }) => {
        const before = await map.scale();
        const zoom = await map.zoom();

        await map.zoomIn.click();

        await map.expectZoom(zoom + 1);
        await map.expectHashZoom(zoom + 1);
        await expect.poll(async () => (await map.scale()).meters).toBeLessThan(before.meters);
    });

    test('MAP-11 Zoom Out button restores the previous level and scale', async ({ readyMap: map }) => {
        const start = await map.scale();
        const zoom = await map.zoom();

        await map.zoomIn.click();
        await map.expectZoom(zoom + 1);
        await map.zoomOut.click();

        await map.expectZoom(zoom);
        await map.expectHashZoom(zoom);
        await expect.poll(async () => (await map.scale()).text).toBe(start.text);
    });

    test('MAP-12 mouse wheel zooms in and shrinks the scale', async ({ readyMap: map }) => {
        const before = await map.scale();
        const zoom = await map.zoom();

        await map.wheel(-300);

        // Wheel zoom is continuous, so assert direction, not a fixed step.
        await expect.poll(() => map.zoom()).toBeGreaterThan(zoom);
        await expect.poll(() => map.hash()?.zoom).toBeGreaterThan(zoom);
        await expect.poll(async () => (await map.scale()).meters).toBeLessThan(before.meters);
    });

    test('MAP-13 mouse wheel zooms out and grows the scale', async ({ readyMap: map }) => {
        const before = await map.scale();
        const zoom = await map.zoom();

        await map.wheel(300);

        await expect.poll(() => map.zoom()).toBeLessThan(zoom);
        await expect.poll(() => map.hash()?.zoom).toBeLessThan(zoom);
        await expect.poll(async () => (await map.scale()).meters).toBeGreaterThan(before.meters);
    });

    test('MAP-14 scale bar switches to the small unit at close zoom', async ({ readyMap: map }) => {
        const far = await map.scale();
        expect(['mi', 'km']).toContain(far.unit);

        // Zoom 18 is street level; the bar drops below 1 mi / 1 km and changes unit.
        await map.gotoView(18, 40, -100);
        await map.waitUntilLoaded();
        await map.expectZoom(18);

        const near = await map.scale();
        expect(['ft', 'm']).toContain(near.unit);
        expect(near.meters).toBeLessThan(far.meters);
    });

    test('MAP-15 zoom stays bounded at max and min zoom', async ({ readyMap: map }) => {
        // Walk to each limit with the button, then confirm one more click is a no-op.
        const max = await map.zoomToLimit(map.zoomIn);
        await map.zoomIn.click();
        await map.expectZoom(max);
        await map.expectHashZoom(max);
        // MAP-29 Zoom In button at max zoom
        await expect(map.scaleBar).toHaveText('3 ft');

        const min = await map.zoomToLimit(map.zoomOut);
        await map.zoomOut.click();
        await map.expectZoom(min);
        await map.expectHashZoom(min);
        expect(min).toBeLessThan(max);
        // MAP-30 Zoom Out button at min zoom
        await expect(map.scaleBar).toHaveText('10000 mi');
    });
});

test.describe('Map: interaction', () => {
    test('MAP-16 pan by dragging moves the center and keeps the zoom', async ({ readyMap: map }) => {
        const start = await map.view();
        const scale = (await map.scale()).text;

        // Horizontal drag: in globe projection the reported zoom shifts with
        // latitude, so keep the latitude fixed to assert zoom exactly.
        await map.drag(-250, 0);

        await expect.poll(async () => (await map.view()).lng).not.toBeCloseTo(start.lng, 1);
        expect((await map.view()).lat).toBeCloseTo(start.lat, 0);
        await map.expectZoom(start.zoom);
        await expect(map.scaleBar).toHaveText(scale);

        await expect.poll(() => map.hash()?.lng).not.toBeCloseTo(start.lng, 1);
        await map.expectHashZoom(start.zoom);
    });

    test('MAP-17 right-drag rotates the map and Snap to North resets the bearing', async ({ readyMap: map }) => {
        // Horizontal right-drag changes bearing only, so pitch stays 0.
        await map.drag(200, 0, { button: 'right' });

        await expect.poll(async () => (await map.view()).bearing).not.toBeCloseTo(0, 0);
        await expect.poll(() => map.hash()?.bearing).not.toBeCloseTo(0, 0);

        await map.snapToNorth.click();

        await map.expectBearing(0);
        await expect.poll(() => map.hash()?.bearing).toBeCloseTo(0, 0);
    });

    test('MAP-18 Ctrl+drag rotates and pitches; Snap to North resets bearing only', async ({ readyMap: map }) => {
        await map.drag(200, -150, { ctrl: true });

        await expect.poll(async () => (await map.view()).bearing).not.toBeCloseTo(0, 0);
        await expect.poll(async () => (await map.view()).pitch).toBeGreaterThan(0);
        await expect.poll(() => map.hash()?.pitch).toBeGreaterThan(0);
        const pitch = (await map.view()).pitch;

        await map.snapToNorth.click();

        // Confirmed with Nicholas: Snap to North must not reset pitch.
        await map.expectBearing(0);
        await expect.poll(() => map.hash()?.bearing).toBeCloseTo(0, 0);
        expect((await map.view()).pitch).toBeCloseTo(pitch, 0);
    });

    test('MAP-19 Search dialog opens with a focused input', async ({ readyMap: map }) => {
        await map.search.click();

        await expect(map.searchTitle).toBeVisible();
        await expect(map.searchInput).toBeVisible();
        await expect(map.searchInput).toBeFocused();
        await expect(map.searchClose).toBeVisible();
    });

    test('MAP-20 Search dialog closes with Escape and the map is interactive', async ({ readyMap: map, page }) => {
        await map.search.click();
        await expect(map.searchInput).toBeFocused();

        await page.keyboard.press('Escape');

        await expect(map.searchTitle).toBeHidden();
        const zoom = await map.zoom();
        await map.zoomIn.click();
        await map.expectZoom(zoom + 1);
    });

    test('MAP-21 Search dialog closes with the × button and the map is interactive', async ({ readyMap: map }) => {
        await map.search.click();
        await expect(map.searchInput).toBeFocused();

        await map.searchClose.click();

        await expect(map.searchTitle).toBeHidden();
        const zoom = await map.zoom();
        await map.zoomIn.click();
        await map.expectZoom(zoom + 1);
    });

    test('MAP-22b Set Your Location without geolocation offers the manual mode', async ({ readyMap: map }) => {
        await expect(map.accuracy).toHaveText('No Fix');

        await map.setLocation.click();

        await expect(map.setLocationPane).toBeVisible();
        await expect(map.useGps).toBeVisible();
        await expect(map.cancelManualLocation).toBeVisible();

        await map.cancelManualLocation.click();
        await expect(map.setLocationPane).toBeHidden();
    });
});

test.describe('Map: interaction with mocked GPS', () => {
    // Playwright grants the permission and feeds a fake position; the app's
    // Capacitor Geolocation reads navigator.geolocation on web.
    test.use({
        permissions: ['geolocation'],
        geolocation: { latitude: 39.7392, longitude: -104.9903, accuracy: 10 }, // Denver
    });

    test('MAP-22a user panel shows the mocked position instead of No Fix', async ({ readyMap: map }) => {
        await expect(map.accuracy).not.toHaveText('No Fix', { timeout: 15_000 });
        await expect(map.coordinates).not.toHaveText('0, 0');
        await expect(map.coordinates).toContainText('39.7');
    });
});

test.describe('Map: menus open and close', () => {
    for (const [tooltip, panel] of Object.entries(MapPage.MENU_PANELS)) {
        test(`MAP-24 ${tooltip} opens ${panel.route}`, async ({ readyMap: map, page }) => {
            await map.menuItem(tooltip).click();

            await expect(page).toHaveURL(new RegExp(`${panel.route}(/|$|\\?|#)`));
            await expect(map.panelTitle).toHaveText(panel.title);
            await expect(map.closeMenu).toBeVisible();
            await expect(map.openMenu).toBeHidden();
        });
    }

    test('MAP-25 Close Menu after a right-side panel restores the map', async ({ readyMap: map, page }) => {
        await map.menuItem('Your Features').click();
        await expect(map.panelTitle).toHaveText('Saved Features');

        await map.closeMenu.click();

        await expect(page).toHaveURL(/\/(#.*)?$/);
        await expect(map.panelTitle).toHaveCount(0);
        await expect(map.openMenu).toBeVisible();
        await expect(map.menubar).toBeVisible();
        await expect(map.zoomIn).toBeVisible();
        await expect(map.gpsPanel).toBeVisible();
        await expect(map.scaleBar).toBeVisible();
    });

    test('MAP-26 Open Menu shows the Main Menu', async ({ readyMap: map, page }) => {
        await map.openMenu.click();

        await expect(page).toHaveURL(/\/menu(\/|$|\?|#)/);
        await expect(map.panelTitle).toHaveText('Main Menu');
        await expect(map.menubar.getByPlaceholder('Search...')).toBeVisible();

        // Full layout shows label + description for each entry (MenuItemCard.vue).
        await expect(map.menubar.getByText('Your Features', { exact: true })).toBeVisible();
        await expect(map.menubar.getByText('Manage saved features')).toBeVisible();
        expect(await map.menuItems.count()).toBeGreaterThanOrEqual(MapPage.DEFAULT_MENU_TOOLTIPS.length);

        await expect(map.menubar.getByText(cloudtakUsername())).toBeVisible();
    });

    test('MAP-27 Close Menu after the Main Menu returns to the map', async ({ readyMap: map, page }) => {
        await map.openMenu.click();
        await expect(map.panelTitle).toHaveText('Main Menu');

        await map.closeMenu.click();

        await expect(page).toHaveURL(/\/(#.*)?$/);
        await expect(map.panelTitle).toHaveCount(0);
        await expect(map.openMenu).toBeVisible();
    });

    test('MAP-28 URL hash is kept after closing a panel', async ({ readyMap: map, page }) => {
        // Marked as expected to fail so the run flips green when it is fixed.
        test.fail(true, 'known bug: hash dropped after closing a menu panel');

        await map.expectMapIdle();
        const before = map.hash();
        expect(before).not.toBeNull();

        await map.menuItem('Your Features').click();
        await expect(map.panelTitle).toHaveText('Saved Features');
        await map.closeMenu.click();
        await expect(map.panelTitle).toHaveCount(0);

        await expect(page).toHaveURL(/#-?\d+(\.\d+)?\/-?\d+(\.\d+)?\/-?\d+(\.\d+)?/);
        expect(map.hash()?.zoom).toBeCloseTo((before as NonNullable<typeof before>).zoom, 1);
    });
});

test.describe('Map: negatives and boundaries', () => {
    test.afterEach(({ pageErrors }) => {
        expect(pageErrors, 'no uncaught page errors').toEqual([]);
    });

    test('MAP-31 mouse wheel at max zoom is a no-op', async ({ readyMap: map, page }) => {
        const max = await map.zoomToLimit(map.zoomIn);
        await expect(map.scaleBar).toHaveText('3 ft');

        await map.wheel(-300);
        await page.waitForTimeout(500); // give a wheel zoom time to happen if it were going to

        await map.expectZoom(max);
        await expect(map.scaleBar).toHaveText('3 ft');
    });

    test('MAP-32 mouse wheel at min zoom is a no-op', async ({ readyMap: map, page }) => {
        const min = await map.zoomToLimit(map.zoomOut);
        await expect(map.scaleBar).toHaveText('10000 mi');

        await map.wheel(300);
        await page.waitForTimeout(500);

        await map.expectZoom(min);
        await expect(map.scaleBar).toHaveText('10000 mi');
    });

    test('MAP-33 scale bar decreases monotonically across the unit switch', async ({ readyMap: map }) => {
        let previous = await map.scale();
        expect(['mi', 'km']).toContain(previous.unit);
        let switched = false;

        // Zoom in one level at a time; every reading must be smaller than the last,
        // including the step where the unit flips from mi/km to ft/m.
        for (let i = 0; i < 20 && !switched; i++) {
            const zoom = await map.zoom();
            await map.zoomIn.click();
            await map.expectZoom(zoom + 1);
            const current = await map.scale();
            expect(current.meters, `zoom ${zoom + 1}: ${current.text} < ${previous.text}`).toBeLessThan(previous.meters);
            switched = current.unit !== previous.unit;
            previous = current;
        }
        expect(switched, 'scale bar should have switched to the small unit').toBe(true);
    });

    test('MAP-34 rapid repeated zoom clicks return to the start', async ({ readyMap: map }) => {
        const zoom = await map.zoom();
        const scale = (await map.scale()).text;

        for (let i = 0; i < 10; i++) await map.zoomIn.click();
        for (let i = 0; i < 10; i++) await map.zoomOut.click();

        await map.expectZoom(zoom);
        await map.expectHashZoom(zoom);
        await expect(map.scaleBar).toHaveText(scale);
    });

    test('MAP-35 pan across the antimeridian keeps a valid longitude', async ({ readyMap: map }) => {
        await map.gotoView(5, 0, 179);
        await map.waitUntilLoaded();
        await map.expectMapIdle();

        await map.drag(-300, 0);

        await expect.poll(async () => (await map.view()).lng).not.toBeCloseTo(179, 0);
        const { lng } = await map.view();
        expect(lng).toBeGreaterThanOrEqual(-180);
        expect(lng).toBeLessThanOrEqual(180);
        await expect.poll(() => map.hash()?.lng).not.toBeNull();
        expect(Math.abs(map.hash()?.lng as number)).toBeLessThanOrEqual(180);
    });

    test('MAP-36 pan toward the pole keeps a valid latitude', async ({ readyMap: map }) => {
        await map.gotoView(4, 84, -100);
        await map.waitUntilLoaded();
        await map.expectMapIdle();

        await map.drag(0, 300);

        const { lat } = await map.view();
        expect(Number.isFinite(lat)).toBe(true);
        expect(Math.abs(lat)).toBeLessThanOrEqual(90);
        await expect(map.canvas.first()).toBeVisible();
    });

    test('MAP-37 rotating a full 360 degrees with Shift+Right returns to north', async ({ readyMap: map, page }) => {
        await map.canvas.first().focus();

        // MapLibre keyboard handler: Shift+Right rotates 15 degrees per press.
        for (let i = 1; i <= 24; i++) {
            await page.keyboard.press('Shift+ArrowRight');
            await map.expectBearing(15 * i);
        }

        await map.expectBearing(0);
        await expect.poll(() => map.hash()?.bearing).toBeCloseTo(0, 0);
    });

    test('MAP-38 Snap to North when already north changes nothing', async ({ readyMap: map, page }) => {
        await map.expectBearing(0);
        await expect.poll(() => map.hash()).not.toBeNull();
        const before = page.url();

        await map.snapToNorth.click();
        await page.waitForTimeout(500);

        await map.expectBearing(0);
        expect(page.url()).toBe(before);
    });

    test('MAP-39 deep link with a valid hash loads that view', async ({ readyMap: map }) => {
        await map.gotoView(10, 39.74, -104.99);
        await map.waitUntilLoaded();
        await map.expectMapIdle();

        await map.expectZoom(10);
        const { lat, lng } = await map.view();
        expect(lat).toBeCloseTo(39.74, 1);
        expect(lng).toBeCloseTo(-104.99, 1);

        // Zoom 10 is city scale: the bar reads a few miles / km.
        const scale = await map.scale();
        expect(scale.meters).toBeGreaterThan(500);
        expect(scale.meters).toBeLessThan(20_000);
    });

    for (const hash of ['abc', '99/999/999', '-1/0/0']) {
        test(`MAP-40 deep link with invalid hash #${hash} falls back gracefully`, async ({ readyMap: map, page }) => {
            await page.goto(`/#${hash}`);
            await map.waitUntilLoaded();
            await map.expectMapIdle();

            const state = await map.state();
            expect(state).not.toBeNull();
            const s = state as NonNullable<typeof state>;
            expect(Number.isFinite(s.zoom) && Number.isFinite(s.lat) && Number.isFinite(s.lng)).toBe(true);
            expect(s.zoom).toBeGreaterThanOrEqual(s.minZoom - 1);
            expect(s.zoom).toBeLessThanOrEqual(s.maxZoom);
            expect(Math.abs(s.lat)).toBeLessThanOrEqual(90);
            await expect(map.zoomIn).toBeVisible();
            await expect(map.menubar).toBeVisible();
        });
    }

    test('MAP-41 unknown menu route degrades gracefully', async ({ readyMap: map, page }) => {
        await page.goto('/menu/doesnotexist');
        await map.waitUntilLoaded();

        await expect(map.canvas.first()).toBeVisible();
        await expect(map.menubar).toBeVisible();
        await expect(map.zoomIn).toBeVisible();
        await expect(map.gpsPanel).toBeVisible();
    });

    test('MAP-42 Escape with no dialog open changes nothing', async ({ readyMap: map, page }) => {
        const before = await map.view();
        const url = page.url();

        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        expect(await map.view()).toEqual(before);
        expect(page.url()).toBe(url);
        await expect(map.searchTitle).toHaveCount(0);
        await expect(map.menubar).toBeVisible();
    });

    test('MAP-43 empty search query sends no request', async ({ readyMap: map, page }) => {
        const searchRequests: string[] = [];
        page.on('request', (req) => {
            if (/\/api\/search\//.test(req.url())) searchRequests.push(req.url());
        });

        await map.search.click();
        await expect(map.searchInput).toBeFocused();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);

        expect(searchRequests).toEqual([]);
        await expect(map.searchTitle).toBeVisible();
    });

    test('MAP-44 long and special-character queries keep the search usable', async ({ readyMap: map, page }) => {
        const errorModal = page.getByText('Website Error');
        const okButton = page.getByText('OK', { exact: true });

        // Backend failure: the app surfaces its error modal and stays usable.
        await page.route('**/api/search/suggest**', (route) => route.fulfill({ status: 500, body: '{}' }));
        await map.search.click();
        await map.searchInput.fill('x'.repeat(300));
        await expect(errorModal).toBeVisible({ timeout: 10_000 });
        await okButton.click();
        await expect(errorModal).toBeHidden();

        // Empty result set: no error, dialog still open.
        await page.unroute('**/api/search/suggest**');
        await page.route('**/api/search/suggest**', (route) => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ items: [] }),
        }));
        for (const query of ['<script>alert(1)</script>', '%', '\'']) {
            await map.searchInput.fill(query);
            await page.waitForTimeout(300);
            await expect(map.searchTitle).toBeVisible();
            await expect(errorModal).toHaveCount(0);
        }
        await expect(map.searchInput).toHaveValue('\'');
    });

    test('MAP-45 rapid open and close of a menu panel ends closed', async ({ readyMap: map, page }) => {
        for (let i = 0; i < 10; i++) {
            await map.menuItem('Your Features').click();
            await map.closeMenu.click();
        }

        await expect(page).toHaveURL(/\/(#.*)?$/);
        await expect(map.panelTitle).toHaveCount(0);
        await expect(map.openMenu).toBeVisible();
        await expect(map.menubar).toBeVisible();
    });

    test('MAP-47 shell works with the tile server unavailable', async ({ readyMap: map, page }) => {
        // Abort every raster/vector tile request (proxied or hosted) before reload.
        await page.route(/\/\d+\/\d+\/\d+(\.(png|jpe?g|webp|pbf|mvt))?(\?|$)/, (route) => route.abort());
        await map.goto();
        await map.waitUntilLoaded();
        await skipPermissionsModal(page);

        await expect(map.zoomIn).toBeVisible();
        await expect(map.menubar).toBeVisible();
        const zoom = await map.zoom();
        await map.zoomIn.click();
        await map.expectZoom(zoom + 1);

        await map.menuItem('Your Features').click();
        await expect(map.panelTitle).toHaveText('Saved Features');
        await map.closeMenu.click();
        await expect(map.panelTitle).toHaveCount(0);
    });
});

test.describe('Map: narrow viewport', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('MAP-46 map shell is reachable at 375px width', async ({ readyMap: map, page, pageErrors }) => {
        // Below the 576px breakpoint (detectMobile) the app switches to the
        // mobile layout, where the right-side menubar is replaced by the menu route.
        await expect(map.activeMission).toBeVisible();
        await expect(map.openMenu).toBeVisible();
        await expect(map.gpsPanel).toBeVisible();
        await expect(map.scaleBar).toBeVisible();
        await expect(map.zoomIn).toHaveCount(0);
        await expect(map.menubar).toHaveCount(0);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, 'no horizontal overflow').toBeLessThanOrEqual(0);
        expect(pageErrors).toEqual([]);
    });
});

test.describe('Map: console health', () => {
    // The console listener must be attached before goto(), so this test loads the map itself.
    test('MAP-48 smoke flow produces no page errors and no unexpected console errors', async ({ map, page, pageErrors }) => {
        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        // Known, by-design noise (stores/map.ts logs tile failures; SW update checks).
        const allowlist = [/tile/i, /TileJSON/i, /basemap/i, /Failed to load resource/i, /websocket/i, /service ?worker/i];

        await map.goto();
        await map.waitUntilLoaded();
        await skipPermissionsModal(page);
        await map.expectMapIdle();

        const zoom = await map.zoom();
        await map.zoomIn.click();
        await map.expectZoom(zoom + 1);
        await map.zoomOut.click();
        await map.expectZoom(zoom);

        await map.menuItem('Your Features').click();
        await expect(map.panelTitle).toHaveText('Saved Features');
        await map.closeMenu.click();
        await expect(map.panelTitle).toHaveCount(0);

        await map.openMenu.click();
        await expect(map.panelTitle).toHaveText('Main Menu');
        await map.closeMenu.click();

        await map.search.click();
        await expect(map.searchInput).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(map.searchTitle).toBeHidden();

        expect(pageErrors).toEqual([]);
        const unexpected = consoleErrors.filter((text) => !allowlist.some((re) => re.test(text)));
        expect(unexpected, 'console errors outside the allowlist').toEqual([]);
    });
});

test.describe('Map: keyboard and box zoom', () => {
    test.beforeEach(async ({ readyMap }) => {
        await readyMap.canvas.first().focus();
    });

    test.afterEach(({ pageErrors }) => {
        expect(pageErrors, 'no uncaught page errors').toEqual([]);
    });

    test('MAP-49 Shift+Left/Right rotate by 15 degrees; Snap to North resets', async ({ readyMap: map, page }) => {
        await page.keyboard.press('Shift+ArrowRight');
        await map.expectBearing(15);
        await expect.poll(() => map.hash()?.bearing).toBeCloseTo(15, 0);

        await page.keyboard.press('Shift+ArrowRight');
        await map.expectBearing(30);

        await page.keyboard.press('Shift+ArrowLeft');
        await map.expectBearing(15);

        await map.snapToNorth.click();
        await map.expectBearing(0);
        await expect.poll(() => map.hash()?.bearing).toBeCloseTo(0, 0);
    });

    test('MAP-50 Shift+Up/Down pitch by 10 degrees within 0..85', async ({ readyMap: map, page }) => {
        const pitch = async () => (await map.view()).pitch;

        // Each press animates; wait for the step to land before the next one. Cap is maxPitch 85.
        for (let i = 1; i <= 10; i++) {
            await page.keyboard.press('Shift+ArrowUp');
            await expect.poll(pitch).toBeCloseTo(Math.min(10 * i, 85), 0);
        }
        await expect.poll(() => map.hash()?.pitch).toBeCloseTo(85, 0);

        for (let i = 1; i <= 10; i++) {
            await page.keyboard.press('Shift+ArrowDown');
            await expect.poll(pitch).toBeCloseTo(Math.max(85 - 10 * i, 0), 0);
        }
    });

    test('MAP-51 arrow keys pan, + and - zoom', async ({ readyMap: map, page }) => {
        const start = await map.view();
        const scale = (await map.scale()).text;

        await page.keyboard.press('ArrowLeft');
        await expect.poll(async () => (await map.view()).lng).not.toBeCloseTo(start.lng, 1);
        await map.expectZoom(start.zoom);

        await page.keyboard.press('=');
        await map.expectZoom(start.zoom + 1);
        await expect(map.scaleBar).not.toHaveText(scale);

        await page.keyboard.press('-');
        await map.expectZoom(start.zoom);
        await expect(map.scaleBar).toHaveText(scale);
    });

    test('MAP-52 Shift+drag box zoom zooms into the drawn rectangle', async ({ readyMap: map }) => {
        const start = await map.view();
        const scale = await map.scale();

        // Box from the centre down-right: its middle lies east and south of the centre.
        await map.drag(240, 160, { shift: true });

        await expect.poll(() => map.zoom()).toBeGreaterThan(start.zoom + 0.5);
        await expect.poll(async () => (await map.view()).lng).toBeGreaterThan(start.lng);
        await expect.poll(async () => (await map.view()).lat).toBeLessThan(start.lat);
        await expect.poll(async () => (await map.scale()).meters).toBeLessThan(scale.meters);
        await expect.poll(async () => Math.abs((await map.zoom()) - (map.hash()?.zoom ?? Number.NaN))).toBeLessThan(0.05);
    });

    test('MAP-53 Shift+click with no drag does not change the view and raises no page error', async ({ readyMap: map, page }) => {
        const before = await map.view();
        const { x, y } = await map.canvasCenter();

        await page.keyboard.down('Shift');
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.up();
        await page.keyboard.up('Shift');
        await map.expectMapIdle();

        expect(await map.view()).toEqual(before);
    });
});