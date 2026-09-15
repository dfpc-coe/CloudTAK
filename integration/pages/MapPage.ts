import type { Page, Locator, Response } from '@playwright/test';
import { expect } from '@playwright/test';

// Live view state read from the MapLibre instance (see MapPage.state).
export type MapState = {
    zoom: number;
    lat: number;
    lng: number;
    bearing: number;
    pitch: number;
    minZoom: number;
    maxZoom: number;
    loaded: boolean;
    tilesLoaded: boolean;
};

// Selector for CloudTAK's `data-test` attribute (the app does not use data-testid).
const dataTest = (name: string): string => `[data-test="${name}"]`;

// The subset of maplibre-gl's Map API used inside page.evaluate.
type MapLibreLike = {
    getZoom(): number;
    getCenter(): { lat: number; lng: number };
    getBearing(): number;
    getPitch(): number;
    getMinZoom(): number;
    getMaxZoom(): number;
    loaded(): boolean;
    areTilesLoaded(): boolean;
};

/**
 * Page Object for the main CloudTAK Map view (/)
 *
 * The map view shows a "Loading Map State" modal while the CoT database,
 * overlays, and MapLibre style are initialized - the view is considered
 * loaded once that modal is gone and the MapLibre canvas is rendered.
 *
 * Locators use the title / data-test attributes already present in the
 * Vue templates under api/web/src; menu tooltips come from stores/modules/menu.ts.
 */
export class MapPage {
    readonly page: Page;
    readonly canvas: Locator;
    readonly loadingModal: Locator;
    // Top bar
    readonly activeMission: Locator;
    readonly notifications: Locator;
    readonly geometryEditing: Locator;
    readonly openMenu: Locator;
    readonly closeMenu: Locator;
    // Left-top navigation stack
    readonly search: Locator;
    readonly snapToNorth: Locator;
    readonly zoomIn: Locator;
    readonly zoomOut: Locator;
    // Right-side compact main menu
    readonly menubar: Locator;
    readonly menuItems: Locator;
    readonly applicationSwitcher: Locator;
    readonly returnHome: Locator;
    readonly version: Locator;
    // Bottom-left GPS / user panel
    readonly gpsPanel: Locator;
    readonly callsign: Locator;
    readonly setLocation: Locator;
    readonly altitude: Locator;
    readonly accuracy: Locator;
    readonly speed: Locator;
    readonly heading: Locator;
    readonly coordinates: Locator;
    // Scale bar
    readonly scaleBar: Locator;
    // "A new version of CloudTAK is ready" banner (App.vue); absent most of the time
    readonly updateBanner: Locator;
    readonly updateBannerClose: Locator;

    static readonly DEFAULT_MENU_TOOLTIPS = [
        'Your Features',
        'Overlays',
        'Contacts',
        'Basemaps',
        'Data Sync',
        'Data Packages',
        'Channels',
        'Videos',
        'Chats',
        'Routes',
        'Files',
        'Imports',
        'Iconsets',
        'History',
        'Display Settings',
    ];

    private tileResponses: Response[] = [];
    private tileTemplate: RegExp | null = null;

    constructor(page: Page) {
        this.page = page;
        this.canvas = page.locator('.maplibregl-canvas');
        this.loadingModal = page.getByText('Loading Map State');

        this.activeMission = page.getByText('No Active Mission');
        this.notifications = page.getByTitle('Notifications Icon');
        this.geometryEditing = page.getByTitle('Geometry Editing');
        this.openMenu = page.getByTitle('Open Menu');
        this.closeMenu = page.getByTitle('Close Menu');

        this.search = page.getByTitle('Search Button');
        this.snapToNorth = page.getByTitle(/^(Snap to North|Orient North)$/);
        this.zoomIn = page.getByTitle('Zoom In Button');
        this.zoomOut = page.getByTitle('Zoom Out Button');

        this.menubar = page.getByRole('menubar');
        this.menuItems = this.menubar.getByRole('menuitem');
        this.applicationSwitcher = this.menubar.getByTitle('Application Switcher');
        this.returnHome = this.menubar.getByTitle('Return Home');
        this.version = this.menubar.locator('.subheader');

        this.gpsPanel = page.locator('.gps-panel');
        this.callsign = this.gpsPanel.locator('.gps-panel-callsign');
        this.setLocation = this.gpsPanel.locator(dataTest('set-location'));
        this.altitude = this.gpsPanel.locator(dataTest('altitude'));
        this.accuracy = this.gpsPanel.locator(dataTest('accuracy'));
        this.speed = this.gpsPanel.locator(dataTest('speed'));
        this.heading = this.gpsPanel.locator(dataTest('heading'));
        this.coordinates = this.gpsPanel.locator(dataTest('coordinates'));

        this.scaleBar = page.locator('.maplibregl-ctrl-scale');

        this.updateBanner = page.getByText('A new version of CloudTAK is ready');
        this.updateBannerClose = this.updateBanner.locator('..').locator('.btn-close');
    }

    menuBadge(tooltip: string): Locator {
        return this.menuItem(tooltip).locator('.menu-item-card__badge--compact');
    }

    // A right-side menu entry, located by its tooltip (stores/modules/menu.ts).
    menuItem(tooltip: string): Locator {
        return this.menuItems.filter({ has: this.page.locator(`[title="${tooltip}"]`) });
    }

    async goto(): Promise<void> {
        await this.page.goto('/');
    }

    async waitUntilLoaded(): Promise<void> {
        await expect(this.canvas.first()).toBeVisible({ timeout: 90_000 });
        await expect(this.loadingModal).toBeHidden({ timeout: 90_000 });
    }

    // Record basemap tile responses (URL template read from the TileJSON). Call BEFORE goto().
    startTileTracking(): void {
        this.tileResponses = [];
        this.tileTemplate = null;

        this.page.on('response', (res) => {
            const url = res.url();

            if (/\/api\/basemap\/\d+\/tiles(\?|$)/.test(url) && !this.tileTemplate) {
                void res.json().then((json: { tiles?: string[] }) => {
                    const template = json.tiles?.[0]?.split('?')[0];
                    if (!template) return;
                    const escaped = template
                        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                        .replace(/\\\{[zxy]\\\}/g, '\\d+');
                    this.tileTemplate = new RegExp(escaped);
                }).catch(() => undefined);
                return;
            }

            if (/\/api\/basemap\/\d+\/tiles\/\d+\/\d+\/\d+/.test(url)) {
                this.tileResponses.push(res);
            } else if (this.tileTemplate && this.tileTemplate.test(url)) {
                this.tileResponses.push(res);
            }
        });
    }

    // Resolve once at least one basemap tile has come back with HTTP 200.
    async expectTilesLoaded(timeout = 60_000): Promise<void> {
        await expect.poll(
            () => this.tileResponses.some((r) => r.status() === 200),
            { timeout, message: 'expected at least one basemap tile response with status 200' },
        ).toBe(true);
    }

    /**
     * Read live view state from the MapLibre instance via the Pinia map store:
     * #app.__vue_app__ -> $pinia -> store 'cloudtak' (stores/map.ts) -> _map.
     * Returns null until the map exists. `_s` is a Pinia internal; if it
     * changes, this is the only place to fix.
     */
    async state(): Promise<MapState | null> {
        return this.page.evaluate(() => {
            const root = document.querySelector('#app') as (Element & { __vue_app__?: unknown }) | null;
            const app = root?.__vue_app__ as {
                config: { globalProperties: { $pinia?: { _s: Map<string, { _map?: MapLibreLike }> } } };
            } | undefined;
            const map = app?.config.globalProperties.$pinia?._s.get('cloudtak')?._map;
            if (!map) return null;

            const center = map.getCenter();
            return {
                zoom: map.getZoom(),
                lat: center.lat,
                lng: center.lng,
                bearing: map.getBearing(),
                pitch: map.getPitch(),
                minZoom: map.getMinZoom(),
                maxZoom: map.getMaxZoom(),
                loaded: map.loaded(),
                tilesLoaded: map.areTilesLoaded(),
            };
        });
    }

    // Resolve once the MapLibre instance reports loaded and all tiles in view loaded.
    async expectMapIdle(timeout = 60_000): Promise<void> {
        await expect.poll(
            async () => {
                const state = await this.state();
                return !!state && state.loaded && state.tilesLoaded;
            },
            { timeout, message: 'expected MapLibre map.loaded() and map.areTilesLoaded() to be true' },
        ).toBe(true);
    }

    // Parse the URL hash #zoom/lat/lng[/bearing/pitch]; null when absent.
    hash(): { zoom: number; lat: number; lng: number; bearing: number; pitch: number } | null {
        const raw = new URL(this.page.url()).hash.replace(/^#/, '');
        if (!raw) return null;

        const parts = raw.split('/').map(Number);
        if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;

        return {
            zoom: parts[0] as number,
            lat: parts[1] as number,
            lng: parts[2] as number,
            bearing: parts[3] ?? 0,
            pitch: parts[4] ?? 0,
        };
    }

    // Parse the scale bar text into value, unit (ft/mi/m/km) and meters.
    async scale(): Promise<{ value: number; unit: string; meters: number; text: string }> {
        const text = (await this.scaleBar.textContent())?.trim() ?? '';
        const match = /^([\d.,]+)\s*(ft|mi|m|km)$/.exec(text);
        if (!match) throw new Error(`Unrecognized scale bar text: "${text}"`);

        const value = Number((match[1] as string).replace(/,/g, ''));
        const unit = match[2] as string;
        const factor: Record<string, number> = { ft: 0.3048, mi: 1609.344, m: 1, km: 1000 };

        return { value, unit, meters: value * (factor[unit] as number), text };
    }
}