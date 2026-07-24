<template>
    <div style='overflow: auto;'>
        <div class='page-body'>
            <div class='container-xl'>
                <div class='row row-deck row-cards'>
                    <div class='col-lg-12'>
                        <div class='card'>
                            <TablerLoading
                                v-if='isAdmin === undefined'
                                desc='Loading Profile'
                            />
                            <TablerAlert
                                v-else-if='!isAdmin'
                                :err='new Error("Insufficient Access")'
                            />
                            <div
                                v-else
                                style='height: 100%;'
                                class='row g-0'
                            >
                                <div
                                    class='border-end'
                                    :style='nest ? "width: 64px;" : ""'
                                    :class='{
                                        "col-12 col-md-3": !nest
                                    }'
                                >
                                    <div class='card-body'>
                                        <h4
                                            v-if='!nest'
                                            class='subheader user-select-none'
                                        >
                                            CloudTAK Admin
                                        </h4>
                                        <div
                                            role='menu'
                                            class='list-group list-group-transparent'
                                        >
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String(route.name).startsWith("admin-server"),
                                                    "cursor-pointer": !String(route.name).startsWith("admin-server")
                                                }'
                                                :title='nest ? "TAK Server Connection" : undefined'
                                                @keyup.enter='router.push(`/admin/server`)'
                                                @click='router.push(`/admin/server`)'
                                            >
                                                <IconServer
                                                    :size='32'
                                                    stroke='1'
                                                />
                                                <span
                                                    v-if='!nest'
                                                    class='mx-3'
                                                >TAK Server Connection</span>
                                            </span>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String(route.name) === "admin-config",
                                                    "cursor-pointer": String(route.name) !== "admin-config"
                                                }'
                                                :title='nest ? "CloudTAK Settings" : undefined'
                                                @keyup.enter='router.push(`/admin/config`)'
                                                @click='router.push(`/admin/config`)'
                                            >
                                                <IconSettings
                                                    :size='32'
                                                    stroke='1'
                                                />
                                                <span
                                                    v-if='!nest'
                                                    class='mx-3'
                                                >CloudTAK Settings</span>
                                            </span>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String(route.name).startsWith("admin-health"),
                                                    "cursor-pointer": !String(route.name).startsWith("admin-health")
                                                }'
                                                :title='nest ? "Health" : undefined'
                                                @keyup.enter='router.push(`/admin/health`)'
                                                @click='router.push(`/admin/health`)'
                                            >
                                                <IconHeartbeat
                                                    :size='32'
                                                    stroke='1'
                                                />
                                                <span
                                                    v-if='!nest'
                                                    class='mx-3'
                                                >Health</span>
                                            </span>
                                        </div>
                                        <h4
                                            v-if='!nest'
                                            class='subheader user-select-none py-2 my-0'
                                        >
                                            Map Settings
                                        </h4>
                                        <div class='list-group list-group-transparent'>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String(route.name).startsWith("admin-user"),
                                                    "cursor-pointer": !String(route.name).startsWith("admin-user")
                                                }'
                                                :title='nest ? "Users" : undefined'
                                                @keyup.enter='router.push(`/admin/user`)'
                                                @click='router.push(`/admin/user`)'
                                            >
                                                <IconUsers
                                                    :size='32'
                                                    stroke='1'
                                                />
                                                <span
                                                    v-if='!nest'
                                                    class='mx-3'
                                                >Users</span>
                                            </span>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String(route.name).startsWith("admin-import"),
                                                    "cursor-pointer": !String(route.name).startsWith("admin-import")
                                                }'
                                                :title='nest ? "User Imports" : undefined'
                                                @keyup.enter='router.push(`/admin/import`)'
                                                @click='router.push(`/admin/import`)'
                                            >
                                                <IconFileImport
                                                    :size='32'
                                                    stroke='1'
                                                />
                                                <span
                                                    v-if='!nest'
                                                    class='mx-3'
                                                >User Imports</span>
                                            </span>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String(route.name).startsWith("admin-public"),
                                                    "cursor-pointer": !String(route.name).startsWith("admin-public")
                                                }'
                                                :title='nest ? "Hosted Tilesets" : undefined'
                                                @keyup.enter='router.push(`/admin/public`)'
                                                @click='router.push(`/admin/public`)'
                                            >
                                                <IconCloud
                                                    :size='32'
                                                    stroke='1'
                                                />
                                                <span
                                                    v-if='!nest'
                                                    class='mx-3'
                                                >Hosted Tilesets</span>
                                            </span>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String(route.name).includes("admin-overlays"),
                                                    "cursor-pointer": !String(route.name).includes("admin-overlays")
                                                }'
                                                :title='nest ? "Basemaps & Overlays" : undefined'
                                                @keyup.enter='router.push(`/admin/overlay`)'
                                                @click='router.push(`/admin/overlay`)'
                                            >
                                                <IconMap
                                                    :size='32'
                                                    stroke='1'
                                                />
                                                <span
                                                    v-if='!nest'
                                                    class='mx-3'
                                                >Basemaps &amp; Overlays</span>
                                            </span>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String(route.name).startsWith("admin-mission-mission-template"),
                                                    "cursor-pointer": !String(route.name).startsWith("admin-mission-template")
                                                }'
                                                :title='nest ? "Mission Templates" : undefined'
                                                @keyup.enter='router.push(`/admin/templates`)'
                                                @click='router.push(`/admin/templates`)'
                                            >
                                                <IconClipboardList
                                                    :size='32'
                                                    stroke='1'
                                                />
                                                <span
                                                    v-if='!nest'
                                                    class='mx-3'
                                                >Mission Templates</span>
                                            </span>
                                        </div>
                                        <h4
                                            v-if='!nest'
                                            class='subheader user-select-none py-2 my-0'
                                        >
                                            ETL Settings
                                        </h4>
                                        <div class='list-group list-group-transparent'>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String(route.name) === "admin-connection",
                                                    "cursor-pointer": String(route.name) !== "admin-connection"
                                                }'
                                                :title='nest ? "Connections" : undefined'
                                                @keyup.enter='router.push(`/admin/connection`)'
                                                @click='router.push(`/admin/connection`)'
                                            >
                                                <IconNetwork
                                                    :size='32'
                                                    stroke='1'
                                                />
                                                <span
                                                    v-if='!nest'
                                                    class='mx-3'
                                                >Connections</span>
                                            </span>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String(route.name) === "admin-layers",
                                                    "cursor-pointer": String(route.name) !== "admin-layers"
                                                }'
                                                :title='nest ? "Layers" : undefined'
                                                @keyup.enter='router.push(`/admin/layer`)'
                                                @click='router.push(`/admin/layer`)'
                                            >
                                                <IconBuildingBroadcastTower
                                                    :size='32'
                                                    stroke='1'
                                                />
                                                <span
                                                    v-if='!nest'
                                                    class='mx-3'
                                                >Layers</span>
                                            </span>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String(route.name).startsWith("admin-tasks"),
                                                    "cursor-pointer": !String(route.name).startsWith("admin-tasks")
                                                }'
                                                :title='nest ? "Integrations" : undefined'
                                                @keyup.enter='router.push(`/admin/tasks`)'
                                                @click='router.push(`/admin/tasks`)'
                                            >
                                                <IconBrandDocker
                                                    :size='32'
                                                    stroke='1'
                                                />
                                                <span
                                                    v-if='!nest'
                                                    class='mx-3'
                                                >Integrations</span>
                                            </span>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String(route.name) === "admin-data",
                                                    "cursor-pointer": String(route.name) !== "admin-data"
                                                }'
                                                :title='nest ? "Data Syncs" : undefined'
                                                @keyup.enter='router.push(`/admin/data`)'
                                                @click='router.push(`/admin/data`)'
                                            >
                                                <IconDatabase
                                                    :size='32'
                                                    stroke='1'
                                                />
                                                <span
                                                    v-if='!nest'
                                                    class='mx-3'
                                                >Data Syncs</span>
                                            </span>
                                        </div>
                                        <h4
                                            v-if='!nest'
                                            class='subheader user-select-none py-2 my-0'
                                        >
                                            External Services
                                        </h4>
                                        <div class='list-group list-group-transparent'>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String(route.name).includes("admin-video"),
                                                    "cursor-pointer": !String(route.name).includes("admin-video")
                                                }'
                                                :title='nest ? "Video Services" : undefined'
                                                @keyup.enter='router.push(`/admin/video`)'
                                                @click='router.push(`/admin/video`)'
                                            >
                                                <IconVideo
                                                    :size='32'
                                                    stroke='1'
                                                />
                                                <span
                                                    v-if='!nest'
                                                    class='mx-3'
                                                >Video Services</span>
                                            </span>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String(route.name).includes("admin-geofence"),
                                                    "cursor-pointer": !String(route.name).includes("admin-geofence")
                                                }'
                                                :title='nest ? "Geofence Server" : undefined'
                                                @keyup.enter='router.push(`/admin/geofence`)'
                                                @click='router.push(`/admin/geofence`)'
                                            >
                                                <IconMapPin
                                                    :size='32'
                                                    stroke='1'
                                                />
                                                <span
                                                    v-if='!nest'
                                                    class='mx-3'
                                                >Geofence Server</span>
                                            </span>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String(route.name).includes("admin-export"),
                                                    "cursor-pointer": !String(route.name).includes("admin-export")
                                                }'
                                                :title='nest ? "Export" : undefined'
                                                @keyup.enter='router.push(`/admin/export`)'
                                                @click='router.push(`/admin/export`)'
                                            >
                                                <IconDatabaseExport
                                                    :size='32'
                                                    stroke='1'
                                                />
                                                <span
                                                    v-if='!nest'
                                                    class='mx-3'
                                                >Export</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div
                                    class='col-12 position-relative'
                                    style='height: 100%;'
                                    :style='nest ? "width: calc(100% - 64px);" : ""'
                                    :class='{
                                        "col-md-9": !nest,
                                    }'
                                >
                                    <Suspense>
                                        <router-view />

                                        <template #fallback>
                                            <TablerLoading />
                                        </template>
                                    </Suspense>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <PageFooter />
    </div>
</template>

<script setup lang='ts'>
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Profile } from '../types.ts';
import { server } from '../std.ts';
import PageFooter from './PageFooter.vue';
import {
    TablerAlert,
    TablerLoading,
} from '@tak-ps/vue-tabler'
import {
    IconCloud,
    IconNetwork,
    IconVideo,
    IconUsers,
    IconFileImport,
    IconMapPin,
    IconSettings,
    IconServer,
    IconHeartbeat,
    IconDatabase,
    IconDatabaseExport,
    IconBrandDocker,
    IconBuildingBroadcastTower,
    IconMap,
    IconClipboardList,
} from '@tabler/icons-vue'

const route = useRoute();
const router = useRouter();
const isAdmin = ref<boolean | undefined>(undefined)

const nest = computed(() => {
    if (String(route.name).startsWith('admin-server')) {
        return true;
    } else {
        return false;
    }
});

onMounted(async () => {
    const res = await server.GET('/api/profile');
    if (res.error) throw new Error(res.error.message);
    isAdmin.value = (res.data as Profile).system_admin;
});
</script>
