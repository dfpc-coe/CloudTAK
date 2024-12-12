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
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "admin-server",
                                                    "cursor-pointer": $route.name !== "admin-server"
                                                }'
                                                @click='$router.push(`/admin/server`)'
                                            >
                                                <IconServer
                                                    :size='32'
                                                    :stroke='1'
                                                /><span class='mx-3'>TAK Server Connection</span>
                                            </span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "admin-config",
                                                    "cursor-pointer": $route.name !== "admin-config"
                                                }'
                                                @click='$router.push(`/admin/config`)'
                                            ><IconSettings
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>CloudTAK Settings</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "admin-task-raw",
                                                    "cursor-pointer": $route.name !== "admin-task-raw"
                                                }'
                                                @click='$router.push(`/admin/task-raw`)'
                                            ><IconBrandDocker
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>ETL Containers</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name.includes("admin-overlays"),
                                                    "cursor-pointer": !$route.name.includes("admin-overlays")
                                                }'
                                                @click='$router.push(`/admin/overlay`)'
                                            ><IconBoxMultiple
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Global Overlays</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "admin-task",
                                                    "cursor-pointer": $route.name !== "admin-task"
                                                }'
                                                @click='$router.push(`/admin/task`)'
                                            ><IconBrandDocker
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Registered Tasks</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "admin-connection",
                                                    "cursor-pointer": $route.name !== "admin-connection"
                                                }'
                                                @click='$router.push(`/admin/connection`)'
                                            ><IconNetwork
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Connections</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "admin-layer",
                                                    "cursor-pointer": $route.name !== "admin-layer"
                                                }'
                                                @click='$router.push(`/admin/layer`)'
                                            ><IconBuildingBroadcastTower
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Layers</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "admin-data",
                                                    "cursor-pointer": $route.name !== "admin-data"
                                                }'
                                                @click='$router.push(`/admin/data`)'
                                            ><IconDatabase
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Data Syncs</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name.startsWith("admin-user"),
                                                    "cursor-pointer": !$route.name.startsWith("admin-user")
                                                }'
                                                @click='$router.push(`/admin/user`)'
                                            ><IconUsers
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Users</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name.includes("admin-video"),
                                                    "cursor-pointer": !$route.name.includes("admin-video")
                                                }'
                                                @click='$router.push(`/admin/video`)'
                                            ><IconVideo
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Video Services</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name.includes("admin-export"),
                                                    "cursor-pointer": !$route.name.includes("admin-export")
                                                }'
                                                @click='$router.push(`/admin/export`)'
                                            ><IconDatabaseExport
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Export</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name.includes("admin-templates"),
                                                    "cursor-pointer": !$route.name.includes("admin-templates")
                                                }'
                                                @click='$router.push(`/admin/template`)'
                                            ><IconTemplate
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Layer Templates</span></span>
                                        </div>
                                    </div>
                                </div>
                                <div class='col-12 col-md-9 position-relative'>
                                    <Suspense>
                                        <router-view/>

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
import { useProfileStore } from '/src/stores/profile.ts';
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
    IconBoxMultiple,
} from '@tabler/icons-vue'
const profileStore = useProfileStore();

onMounted(async () => {
    await profileStore.load();
});
</script>
