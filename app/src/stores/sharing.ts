/**
 * TAK.NZ: pause / resume sharing (native app only).
 *
 * "Paused" means the user has chosen to be offline. Nothing about them leaves
 * the device and nothing reaches them until they resume:
 *   - the TAK server connection is closed and the self position is not broadcast
 *   - the location watch is stopped (which also removes the Android
 *     "location is being used" notification)
 *   - the screen wake lock is released
 *   - this device's push registration is removed, so the server stops sending
 *     alerts to it
 *
 * The choice survives app restarts and reboots: the app starts paused and stays
 * paused until the user taps Resume. It is remembered for the user who paused;
 * if a different user signs in on the same device they start live.
 */
import { defineStore } from 'pinia';
import { Preferences } from '@capacitor/preferences';
import { isNativePlatform } from '../utils/capacitor.ts';
import { LocationState } from '../utils/events.ts';
import { syncPushToken, unregisterPushToken } from '../base/push.ts';
import ProfileConfig from '../base/profile.ts';
import { useAppStore } from './app.ts';
import { useDeviceStore } from './device.ts';
import { useMapStore } from './map.ts';

/** Preferences key holding the username that paused sharing on this device */
export const PAUSED_BY_KEY = 'sharingPausedBy';

export const useSharingStore = defineStore('sharing', {
    state: () => ({
        paused: false,
        // A pause or resume is in progress
        busy: false,
        // Set when a step of the last pause or resume failed
        error: null as string | null,
    }),
    actions: {
        /**
         * Read whether `username` left this device paused. Call before the
         * worker connects. A pause belonging to anyone else is discarded
         */
        async load(username: string): Promise<boolean> {
            if (!isNativePlatform()) {
                this.paused = false;
                return false;
            }
            const { value } = await Preferences.get({ key: PAUSED_BY_KEY });
            if (value && value !== username) {
                await Preferences.remove({ key: PAUSED_BY_KEY });
            }
            this.paused = !!value && value === username;
            return this.paused;
        },

        async pause(): Promise<void> {
            if (this.paused || this.busy) return;
            this.busy = true;
            this.error = null;
            try {
                const username = await useAppStore().getUsername();
                if (!username) throw new Error('Not logged in');

                // Remember first: whatever happens below, the app must come
                // back paused, never silently live
                await Preferences.set({ key: PAUSED_BY_KEY, value: username });
                this.paused = true;

                const map = useMapStore();
                const device = useDeviceStore();
                const failed: string[] = [];
                const step = async (name: string, run: () => Promise<unknown> | unknown) => {
                    try {
                        await run();
                    } catch (err) {
                        console.error(`Failed to pause ${name}`, err);
                        failed.push(name);
                    }
                };

                await step('the server connection', () => map.worker.pauseSharing());
                await step('location', async () => {
                    await device.geolocation.stopWatch();
                    map.location = LocationState.Disabled;
                    map.syncGeolocateControl();
                });
                await step('the wake lock', () => device.releaseWakeLockSentinel());
                await step('notifications', () => unregisterPushToken());

                if (failed.length) {
                    this.error = `Paused, but could not stop ${failed.join(', ')}. Try again, or close the app.`;
                }
            } catch (err) {
                console.error('Failed to pause sharing', err);
                this.error = err instanceof Error ? err.message : 'Failed to pause sharing';
            } finally {
                this.busy = false;
            }
        },

        async resume(): Promise<void> {
            if (!this.paused || this.busy) return;
            this.busy = true;
            this.error = null;
            try {
                await Preferences.remove({ key: PAUSED_BY_KEY });
                this.paused = false;

                const map = useMapStore();
                const device = useDeviceStore();
                const failed: string[] = [];
                const step = async (name: string, run: () => Promise<unknown> | unknown) => {
                    try {
                        await run();
                    } catch (err) {
                        console.error(`Failed to resume ${name}`, err);
                        failed.push(name);
                    }
                };

                await step('the server connection', () => map.worker.resumeSharing());
                await step('location', async () => {
                    map.location = LocationState.Loading;
                    await map.startLocationWatch();
                });
                await step('the wake lock', async () => {
                    const mode = (await ProfileConfig.get('display_wakelock'))?.value;
                    await device.wakeLock.applyPreference(mode);
                });
                await step('notifications', () => syncPushToken(device.getMessagingToken()));

                if (failed.length) {
                    this.error = `Resumed, but could not restart ${failed.join(', ')}.`;
                }
            } catch (err) {
                console.error('Failed to resume sharing', err);
                this.error = err instanceof Error ? err.message : 'Failed to resume sharing';
            } finally {
                this.busy = false;
            }
        },
    },
});
