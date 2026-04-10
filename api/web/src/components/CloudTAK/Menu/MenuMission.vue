<template>
    <MenuTemplate
        :name='subscription ? subscription.meta.name : "Data Sync"'
        :error='error'
        :loading='(!subscription && !error) || loading'
    >
        <template #buttons>
            <TablerDelete
                v-if='!loading && subscription && subscription.role.permissions.includes("MISSION_WRITE")'
                v-tooltip='"Delete"'
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
                            @click='shareToPackageSetup'
                        >
                            <IconPackages
                                :size='32'
                                stroke='1'
                            />
                            <span class='mx-2'>Export Data Package</span>
                        </div>
                        <div
                            class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                            @click='exportToPackage("geojson")'
                        >
                            <IconFile
                                :size='32'
                                stroke='1'
                            />
                            <span class='mx-2'>Export GeoJSON</span>
                        </div>
                        <div
                            class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                            @click='exportToPackage("kml")'
                        >
                            <IconFile
                                :size='32'
                                stroke='1'
                            />
                            <span class='mx-2'>Export KML</span>
                        </div>
                        <div
                            class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                            @click='exportToPackage("zip")'
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
                @click='fetchMission'
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
                        <component
                            :is='missionTabIcons[option.value]'
                            v-tooltip='option.label'
                            :size='32'
                            stroke='1'
                        />
                    </template>
                </TablerPillGroup>

                <Suspense>
                    <router-view
                        v-if='subscription'
                        :subscription='subscription'
                        @refresh='fetchMission(true)'
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
import { ref, onMounted } from 'vue';
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

onMounted(async () => {
    await fetchMission();
})

async function shareToPackageSetup(): Promise<void> {
    if (!subscription.value) return;
    shareToPackage.value.features = (await subscription.value.feature.collection(true)).features as Feature[];
    shareToPackage.value.shown = true;
}

async function deleteMission() {
    loading.value = true;

    if (!subscription.value) return;

    if (mapStore.mission && mapStore.mission.guid === subscription.value.guid) {
        await mapStore.makeActiveMission(undefined);
    }

    await subscription.value.delete();

    const overlay = mapStore.getOverlayByMode('mission', String(route.params.mission));
    if (overlay) await mapStore.removeOverlay(overlay);

    router.replace('/menu/missions');
}

async function exportToPackage(format: string): Promise<void> {
    if (!subscription.value) return;

    loadingInline.value = 'Generating Archive'
    await std(`/api/marti/missions/${encodeURIComponent(subscription.value.guid)}/archive?download=true&format=${format}`, {
        download: true
    })
    loadingInline.value = undefined;
}

async function fetchMission(reload = false): Promise<void> {
    loading.value = true;

    try {
        subscription.value = await Subscription.load(String(route.params.mission), {
            reload,
            token: String(localStorage.token),
            missiontoken: token.value,
        });

        loading.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        loading.value = false;
    }
}
</script>
