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
                                                    "active": String($route.name).startsWith("admin-server"),
                                                    "cursor-pointer": !String($route.name).startsWith("admin-server")
                                                }'
                                                @click='$router.push(`/admin/server`)'
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
                                                    "active": String($route.name) === "admin-config",
                                                    "cursor-pointer": String($route.name) !== "admin-config"
                                                }'
                                                @click='$router.push(`/admin/config`)'
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
                                                    "active": String($route.name).startsWith("admin-user"),
                                                    "cursor-pointer": !String($route.name).startsWith("admin-user")
                                                }'
                                                @click='$router.push(`/admin/user`)'
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
                                                    "active": String($route.name).includes("admin-overlays"),
                                                    "cursor-pointer": !String($route.name).includes("admin-overlays")
                                                }'
                                                @click='$router.push(`/admin/overlay`)'
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
                                                    "active": String($route.name).startsWith("admin-palette"),
                                                    "cursor-pointer": !String($route.name).startsWith("admin-palette")
                                                }'
                                                @click='$router.push(`/admin/palette`)'
                                            >
                                                <IconBrush
                                                    :size='32'
                                                    stroke='1'
                                                />
                                                <span
                                                    v-if='!nest'
                                                    class='mx-3'
                                                >Draw Palette</span>
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
                                                    "active": String($route.name) === "admin-connection",
                                                    "cursor-pointer": String($route.name) !== "admin-connection"
                                                }'
                                                @click='$router.push(`/admin/connection`)'
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
                                                    "active": String($route.name) === "admin-layer",
                                                    "cursor-pointer": String($route.name) !== "admin-layer"
                                                }'
                                                @click='$router.push(`/admin/layer`)'
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
                                                    "active": String($route.name).includes("admin-templates"),
                                                    "cursor-pointer": !String($route.name).includes("admin-templates")
                                                }'
                                                @click='$router.push(`/admin/template`)'
                                            >
                                                <IconTemplate
                                                    :size='32'
                                                    stroke='1'
                                                />
                                                <span
                                                    v-if='!nest'
                                                    class='mx-3'
                                                >Layer Templates</span>
                                            </span>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String($route.name).startsWith("admin-tasks"),
                                                    "cursor-pointer": !String($route.name).startsWith("admin-tasks")
                                                }'
                                                @click='$router.push(`/admin/tasks`)'
                                            >
                                                <IconBrandDocker
                                                    :size='32'
                                                    stroke='1'
                                                />
                                                <span
                                                    v-if='!nest'
                                                    class='mx-3'
                                                >ETL Task Runners</span>
                                            </span>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String($route.name) === "admin-data",
                                                    "cursor-pointer": String($route.name) !== "admin-data"
                                                }'
                                                @click='$router.push(`/admin/data`)'
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
                                                    "active": String($route.name).includes("admin-video"),
                                                    "cursor-pointer": !String($route.name).includes("admin-video")
                                                }'
                                                @click='$router.push(`/admin/video`)'
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
                                                    "active": String($route.name).includes("admin-export"),
                                                    "cursor-pointer": !String($route.name).includes("admin-export")
                                                }'
                                                @click='$router.push(`/admin/export`)'
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
                            `
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
import { useRoute } from 'vue-router';
import type { Profile } from '../types.ts';
import { std } from '../std.ts';
import PageFooter from './PageFooter.vue';
import {
    TablerAlert,
    TablerLoading,
} from '@tak-ps/vue-tabler'
import {
    IconBrush,
    IconNetwork,
    IconTemplate,
    IconVideo,
    IconUsers,
    IconSettings,
    IconServer,
    IconDatabase,
    IconDatabaseExport,
    IconBrandDocker,
    IconBuildingBroadcastTower,
    IconMap,
} from '@tabler/icons-vue'

const route = useRoute();
const isAdmin = ref<boolean | undefined>(undefined)

const nest = computed(() => {
    if (route.name.startsWith('admin-server')) {
        return true;
    } else {
        return false;
    }
});

onMounted(async () => {
    const profile = await std('/api/profile') as Profile;
    isAdmin.value = profile.system_admin;
});
</script>
