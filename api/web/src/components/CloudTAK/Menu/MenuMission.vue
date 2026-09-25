<template>
    <MenuTemplate
        :name='subscription ? subscription.meta.name : "Data Sync"'
        :loading='(!subscription && !error) || loading'
        :scroll='false'
    >
        <template #buttons>
            <TablerDelete
                v-if='!loading && subscription && subscription.subscribed && subscription.role.permissions.includes("MISSION_DELETE")'
                title='Delete'
                :label='"Delete " + (subscription.meta.name || "Data Sync")'
                displaytype='icon'
                match='Delete Data Sync'
                @delete='deleteMission'
            />
            <TablerDropdown
                v-if='subscription && subscription.subscribed'
            >
                <TablerIconButton
                    title='More Options'
                >
                    <IconDotsVertical
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>

                <template #dropdown>
                    <div class='col-12'>
                        <div
                            class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                            @click.stop='shareToPackageSetup'
                        >
                            <IconPackages
                                :size='32'
                                stroke='1'
                            />
                            <span class='mx-2'>Export Data Package</span>
                        </div>
                        <div
                            class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                            @click.stop='exportToPackage("geojson")'
                        >
                            <IconFile
                                :size='32'
                                stroke='1'
                            />
                            <span class='mx-2'>Export GeoJSON</span>
                        </div>
                        <div
                            class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                            @click.stop='exportToPackage("kml")'
                        >
                            <IconFile
                                :size='32'
                                stroke='1'
                            />
                            <span class='mx-2'>Export KML</span>
                        </div>
                        <div
                            class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                            @click.stop='exportToPackage("zip")'
                        >
                            <IconFileZip
                                :size='32'
                                stroke='1'
                            />
                            <span class='mx-2'>Download Archive</span>
                        </div>
                    </div>
                </template>
            </TablerDropdown>
            <TablerRefreshButton
                :loading='(!subscription && !error) || loading'
                @click='fetchMission(true)'
            />
        </template>
        <template #default>
            <TablerLoading
                v-if='loadingInline'
                :desc='loadingInline'
                :compact='true'
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <template v-else>
                <TablerPillGroup
                    v-if='subscription && subscription.subscribed'
                    :model-value='String(route.name)'
                    :options='missionTabs'
                    @update:model-value='navigateMissionTab'
                >
                    <template #option='{ option }'>
                        <span :title='option.label'>
                            <component
                                :is='missionTabIcons[option.value]'
                                :size='32'
                                stroke='1'
                            />
                        </span>
                    </template>
                </TablerPillGroup>

                <Suspense>
                    <router-view
                        v-if='subscription'
                        :subscription='subscription'
                        @subscribed='subscribedChanged'
                    />

                    <template #fallback>
                        <TablerLoading />
                    </template>
                </Suspense>
            </template>
        </template>
    </MenuTemplate>

    <ShareToPackage
        v-if='shareToPackage.shown && subscription'
        :name='`${new Date().toISOString().replace(/T.*/, "")} ${subscription ? subscription.meta.name : "Mission"}`'
        :feats='shareToPackage.features'
        @close='shareToPackage.shown = false'
    />
</template>

<script setup lang='ts'>
import { ref, triggerRef, onMounted, onBeforeUnmount, watch } from 'vue';
import { std } from '../../../std.ts';
import type { Feature } from '../../../types.ts';
import type { Component } from 'vue';
import Subscription from '../../../base/subscription.ts';
import {
    IconFile,
    IconPackages,
    IconFileZip,
    IconBoxMultiple,
    IconDotsVertical,
    IconArticle,
    IconTimeline,
    IconFiles,
    IconInfoSquare,
    IconUsers,
    IconMessage,
} from '@tabler/icons-vue';
import {
    TablerAlert,
    TablerLoading,
    TablerDropdown,
    TablerDelete,
    TablerIconButton,
    TablerRefreshButton,
    TablerPillGroup
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import ShareToPackage from '../util/ShareToPackage.vue';
import { useRoute, useRouter } from 'vue-router';
import { useMapStore } from '../../../stores/map.ts';
import OverlayManager from '../../../base/overlay.ts';

const mapStore = useMapStore();
const route = useRoute();
const router = useRouter();

const missionTabs = [
    { value: 'home-menu-mission-info', label: 'Metadata' },
    { value: 'home-menu-mission-layers', label: 'Layers' },
    { value: 'home-menu-mission-users', label: 'Users' },
    { value: 'home-menu-mission-changes', label: 'Changes' },
    { value: 'home-menu-mission-logs', label: 'Logs' },
    { value: 'home-menu-mission-contents', label: 'Files' },
    { value: 'home-menu-mission-chats', label: 'Chats' },
];

const missionTabIcons: Record<string, Component> = {
    'home-menu-mission-info': IconInfoSquare,
    'home-menu-mission-layers': IconBoxMultiple,
    'home-menu-mission-users': IconUsers,
    'home-menu-mission-changes': IconTimeline,
    'home-menu-mission-logs': IconArticle,
    'home-menu-mission-contents': IconFiles,
    'home-menu-mission-chats': IconMessage,
};

function navigateMissionTab(name: string) {
    const suffix = name.replace('home-menu-mission-', '');
    router.replace(`/menu/missions/${route.params.mission}/${suffix}`);
}

const error = ref<Error | undefined>(undefined);
const token = ref<string | undefined>(route.query.token ? String(route.query.token) : undefined)
const loading = ref(false);

const shareToPackage = ref<{
    shown: boolean,
    features: Feature[]
}>({
    shown: false,
    features: []
});

const loadingInline = ref<string | undefined>(undefined);
const subscription = ref<Subscription | undefined>(undefined)

// Bumped per load and on unmount so a late response is closed, not adopted
let fetchSeq = 0;

onMounted(async () => {
    await fetchMission();
})

onBeforeUnmount(() => {
    fetchSeq++;
    setSubscription(undefined);
});

// The route is reused when moving between missions
watch(() => route.params.mission, async (guid, previous) => {
    if (!guid || guid === previous) return;

    setSubscription(undefined);
    token.value = route.query.token ? String(route.query.token) : undefined;

    await fetchMission();
});

function setSubscription(next: Subscription | undefined): void {
    const previous = subscription.value;
    subscription.value = next;
    if (previous && previous !== next) previous.close();
}

function subscribedChanged(): void {
    triggerRef(subscription);
}

async function shareToPackageSetup(): Promise<void> {
    if (!subscription.value) return;
    shareToPackage.value.features = (await subscription.value.feature.collection(true)).features as Feature[];
    shareToPackage.value.shown = true;
}

async function deleteMission() {
    if (!subscription.value) return;

    loading.value = true;
    error.value = undefined;

    try {
        if (mapStore.mission && mapStore.mission.guid === subscription.value.guid) {
            await mapStore.makeActiveMission(undefined);
        }

        await subscription.value.delete();

        const overlay = OverlayManager.loadedByMode('mission', String(route.params.mission));
        if (overlay) {
            await OverlayManager.deleteLoaded(overlay);
        }

        router.replace('/menu/missions');
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
}

async function exportToPackage(format: string): Promise<void> {
    if (!subscription.value) return;

    loadingInline.value = 'Generating Archive'

    try {
        await std(`/api/marti/missions/${encodeURIComponent(subscription.value.guid)}/archive?download=true&format=${format}`, {
            download: true
        })
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loadingInline.value = undefined;
    }
}

async function fetchMission(reload = false): Promise<void> {
    const seq = ++fetchSeq;
    const guid = String(route.params.mission);

    loading.value = true;
    error.value = undefined;

    try {
        const sub = await Subscription.load(guid, {
            reload,
            missiontoken: token.value,
            live: true,
        });

        if (seq !== fetchSeq) {
            sub.close();
            return;
        }

        setSubscription(sub);
    } catch (err) {
        if (seq !== fetchSeq) return;

        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        if (seq === fetchSeq) loading.value = false;
    }
}
</script>
