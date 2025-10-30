<template>
    <MenuTemplate
        :name='subscription ? subscription.meta.name : "Mission"'
        :error='error'
        :loading='(!subscription && !error) || loading'
    >
        <template #buttons>
            <TablerDelete
                v-if='!loading && subscription && subscription.role.permissions.includes("MISSION_WRITE")'
                v-tooltip='"Delete"'
                displaytype='icon'
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
                    <div clas='col-12'>
                        <div
                            class='cursor-pointer col-12 hover d-flex align-items-center px-2 py-2'
                            @click='shareToPackageSetup'
                        >
                            <IconPackages
                                :size='32'
                                stroke='1'
                            />
                            <span class='mx-2'>Export Data Package</span>
                        </div>
                        <div
                            class='cursor-pointer col-12 hover d-flex align-items-center px-2 py-2'
                            @click='exportToPackage("geojson")'
                        >
                            <IconFile
                                :size='32'
                                stroke='1'
                            />
                            <span class='mx-2'>Export GeoJSON</span>
                        </div>
                        <div
                            class='cursor-pointer col-12 hover d-flex align-items-center px-2 py-2'
                            @click='exportToPackage("kml")'
                        >
                            <IconFile
                                :size='32'
                                stroke='1'
                            />
                            <span class='mx-2'>Export KML</span>
                        </div>
                        <div
                            class='cursor-pointer col-12 hover d-flex align-items-center px-2 py-2'
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
                <div
                    v-if='subscription && subscription.subscribed'
                    class='px-2 py-2 round btn-group w-100'
                    role='group'
                >
                    <input
                        id='info'
                        type='radio'
                        class='btn-check'
                        autocomplete='off'
                        :checked='route.name === "home-menu-mission-info"'
                        @click='router.replace(`/menu/missions/${route.params.mission}/info`)'
                    >
                    <label
                        for='info'
                        type='button'
                        class='btn btn-sm'
                    ><IconInfoSquare
                        v-tooltip='"Metadata"'
                        :size='32'
                        stroke='1'
                    /></label>

                    <input
                        id='layer'
                        type='radio'
                        class='btn-check'
                        autocomplete='off'
                        :checked='route.name === "home-menu-mission-layers"'
                        @click='router.replace(`/menu/missions/${route.params.mission}/layers`)'
                    >
                    <label
                        for='layer'
                        type='button'
                        class='btn btn-sm'
                    ><IconBoxMultiple
                        v-tooltip='"Layers"'
                        :size='32'
                        stroke='1'
                    /></label>

                    <input
                        id='users'
                        type='radio'
                        class='btn-check'
                        autocomplete='off'
                        :checked='route.name === "home-menu-mission-users"'
                        @click='router.replace(`/menu/missions/${route.params.mission}/users`)'
                    >
                    <label
                        for='users'
                        type='button'
                        class='btn btn-sm'
                    ><IconUsers
                        v-tooltip='"Users"'
                        :size='32'
                        stroke='1'
                    /></label>

                    <input
                        id='timeline'
                        type='radio'
                        class='btn-check'
                        autocomplete='off'
                        :checked='route.name === "home-menu-mission-timeline"'
                        @click='router.replace(`/menu/missions/${route.params.mission}/timeline`)'
                    >
                    <label
                        for='timeline'
                        type='button'
                        class='btn btn-sm'
                    ><IconTimeline
                        v-tooltip='"Timeline"'
                        :size='32'
                        stroke='1'
                    /></label>

                    <input
                        id='logs'
                        type='radio'
                        class='btn-check'
                        autocomplete='off'
                        :checked='route.name === "home-menu-mission-logs"'
                        @click='router.replace(`/menu/missions/${route.params.mission}/logs`)'
                    >
                    <label
                        for='logs'
                        type='button'
                        class='btn btn-sm'
                    ><IconArticle
                        v-tooltip='"Logs"'
                        :size='32'
                        stroke='1'
                    /></label>

                    <input
                        id='contents'
                        type='radio'
                        class='btn-check'
                        autocomplete='off'
                        :checked='route.name === "home-menu-mission-contents"'
                        @click='router.replace(`/menu/missions/${route.params.mission}/contents`)'
                    >
                    <label
                        for='contents'
                        type='button'
                        class='btn btn-sm'
                    ><IconFiles
                        v-tooltip='"Files"'
                        :size='32'
                        stroke='1'
                    /></label>
                </div>

                <Suspense>
                    <router-view
                        v-if='subscription'
                        :subscription='subscription'
                        @refresh='fetchMission'
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
} from '@tabler/icons-vue';
import {
    TablerAlert,
    TablerLoading,
    TablerDropdown,
    TablerDelete,
    TablerIconButton,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import ShareToPackage from '../util/ShareToPackage.vue';
import { useRoute, useRouter } from 'vue-router';
import { useMapStore } from '../../../stores/map.ts';

const mapStore = useMapStore();
const route = useRoute();
const router = useRouter();

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

async function fetchMission(): Promise<void> {
    try {
        subscription.value = await Subscription.load(String(route.params.mission), {
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
