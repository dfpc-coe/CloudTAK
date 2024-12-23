<template>
    <div style='overflow: auto;'>
        <div class='page-body'>
            <div class='container-xl'>
                <div class='row row-deck row-cards'>
                    <div class='col-lg-12'>
                        <div class='card'>
                            <TablerLoading
                                v-if='!profileStore.profile'
                                desc='Loading Profile'
                            />
                            <TablerAlert
                                v-else-if='!profileStore.profile.system_admin'
                                :err='new Error("Insufficient Access")'
                            />
                            <div
                                v-else
                                class='row g-0'
                            >
                                <div class='col-12 col-md-3 border-end'>
                                    <div class='card-body'>
                                        <h4 class='subheader'>
                                            CloudTAK Admin
                                        </h4>
                                        <div class='list-group list-group-transparent'>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String($route.name) === "admin-server",
                                                    "cursor-pointer": String($route.name) !== "admin-server"
                                                }'
                                                @click='$router.push(`/admin/server`)'
                                            >
                                                <IconServer
                                                    :size='32'
                                                    stroke='1'
                                                /><span class='mx-3'>TAK Server Connection</span>
                                            </span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String($route.name) === "admin-config",
                                                    "cursor-pointer": String($route.name) !== "admin-config"
                                                }'
                                                @click='$router.push(`/admin/config`)'
                                            ><IconSettings
                                                :size='32'
                                                stroke='1'
                                            /><span class='mx-3'>CloudTAK Settings</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String($route.name).startsWith("admin-tasks"),
                                                    "cursor-pointer": !String($route.name).startsWith("admin-tasks")
                                                }'
                                                @click='$router.push(`/admin/tasks`)'
                                            ><IconBrandDocker
                                                :size='32'
                                                stroke='1'
                                            /><span class='mx-3'>ETL Task Runners</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String($route.name).includes("admin-overlays"),
                                                    "cursor-pointer": !String($route.name).includes("admin-overlays")
                                                }'
                                                @click='$router.push(`/admin/overlay`)'
                                            ><IconMap
                                                :size='32'
                                                stroke='1'
                                            /><span class='mx-3'>Basemaps &amp; Overlays</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String($route.name) === "admin-connection",
                                                    "cursor-pointer": String($route.name) !== "admin-connection"
                                                }'
                                                @click='$router.push(`/admin/connection`)'
                                            ><IconNetwork
                                                :size='32'
                                                stroke='1'
                                            /><span class='mx-3'>Connections</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String($route.name) === "admin-layer",
                                                    "cursor-pointer": String($route.name) !== "admin-layer"
                                                }'
                                                @click='$router.push(`/admin/layer`)'
                                            ><IconBuildingBroadcastTower
                                                :size='32'
                                                stroke='1'
                                            /><span class='mx-3'>Layers</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String($route.name) === "admin-data",
                                                    "cursor-pointer": String($route.name) !== "admin-data"
                                                }'
                                                @click='$router.push(`/admin/data`)'
                                            ><IconDatabase
                                                :size='32'
                                                stroke='1'
                                            /><span class='mx-3'>Data Syncs</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String($route.name).startsWith("admin-user"),
                                                    "cursor-pointer": !String($route.name).startsWith("admin-user")
                                                }'
                                                @click='$router.push(`/admin/user`)'
                                            ><IconUsers
                                                :size='32'
                                                stroke='1'
                                            /><span class='mx-3'>Users</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String($route.name).includes("admin-video"),
                                                    "cursor-pointer": !String($route.name).includes("admin-video")
                                                }'
                                                @click='$router.push(`/admin/video`)'
                                            ><IconVideo
                                                :size='32'
                                                stroke='1'
                                            /><span class='mx-3'>Video Services</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String($route.name).includes("admin-export"),
                                                    "cursor-pointer": !String($route.name).includes("admin-export")
                                                }'
                                                @click='$router.push(`/admin/export`)'
                                            ><IconDatabaseExport
                                                :size='32'
                                                stroke='1'
                                            /><span class='mx-3'>Export</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": String($route.name).includes("admin-templates"),
                                                    "cursor-pointer": !String($route.name).includes("admin-templates")
                                                }'
                                                @click='$router.push(`/admin/template`)'
                                            ><IconTemplate
                                                :size='32'
                                                stroke='1'
                                            /><span class='mx-3'>Layer Templates</span></span>
                                        </div>
                                    </div>
                                </div>
                                <div class='col-12 col-md-9 position-relative'>
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
import { onMounted } from 'vue';
import { useProfileStore } from '../../src/stores/profile.ts';
import PageFooter from './PageFooter.vue';
import {
    TablerAlert,
    TablerLoading,
} from '@tak-ps/vue-tabler'
import {
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
const profileStore = useProfileStore();

onMounted(async () => {
    await profileStore.load();
});
</script>
