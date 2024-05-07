<template>
    <div>
        <div class='page-wrapper'>
            <div class='page-header d-print-none'>
                <div class='container-xl'>
                    <div class='row g-2 align-items-center'>
                        <div class='col d-flex'>
                            <TablerBreadCrumb />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class='page-body'>
            <div class='container-xl'>
                <div class='row row-deck row-cards'>
                    <div class='col-lg-12'>
                        <TablerLoading
                            v-if='!profile'
                            desc='Loading Profile'
                        />
                        <Alert
                            v-else-if='!profile.system_admin'
                            :err='new Error("Insufficient Access")'
                        />
                        <div
                            v-else
                            class='card'
                        >
                            <div class='row g-0'>
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
                                            ><IconServer size='32' /><span class='mx-3'>TAK Server</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "admin-config",
                                                    "cursor-pointer": $route.name !== "admin-config"
                                                }'
                                                @click='$router.push(`/admin/config`)'
                                            ><IconSettings size='32' /><span class='mx-3'>Settings</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "admin-task",
                                                    "cursor-pointer": $route.name !== "admin-task"
                                                }'
                                                @click='$router.push(`/admin/task`)'
                                            ><IconBrandDocker size='32' /><span class='mx-3'>ETL Tasks</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "admin-connection",
                                                    "cursor-pointer": $route.name !== "admin-connection"
                                                }'
                                                @click='$router.push(`/admin/connection`)'
                                            ><IconNetwork size='32' /><span class='mx-3'>Connections</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "admin-layer",
                                                    "cursor-pointer": $route.name !== "admin-layer"
                                                }'
                                                @click='$router.push(`/admin/layer`)'
                                            ><IconBuildingBroadcastTower size='32' /><span class='mx-3'>Layers</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "admin-user",
                                                    "cursor-pointer": $route.name !== "admin-user"
                                                }'
                                                @click='$router.push(`/admin/user`)'
                                            ><IconUsers size='32' /><span class='mx-3'>Users</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name.includes("admin-video"),
                                                    "cursor-pointer": !$route.name.includes("admin-video")
                                                }'
                                                @click='$router.push(`/admin/video`)'
                                            ><IconVideo size='32' /><span class='mx-3'>Video Servers</span></span>
                                        </div>
                                    </div>
                                </div>
                                <div class='col-12 col-md-9 position-relative'>
                                    <router-view
                                        :data='data'
                                    />
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

<script>
import { useProfileStore } from '/src/stores/profile.ts';
import PageFooter from './PageFooter.vue';
import Alert from './util/Alert.vue';
import {
    TablerLoading,
    TablerBreadCrumb,
} from '@tak-ps/vue-tabler'
import {
    IconNetwork,
    IconVideo,
    IconUsers,
    IconSettings,
    IconServer,
    IconBrandDocker,
    IconBuildingBroadcastTower,
} from '@tabler/icons-vue'
import { mapState } from 'pinia'
const profileStore = useProfileStore();

export default {
    name: 'ServerAdmin',
    computed: {
        ...mapState(useProfileStore, ['profile']),
    },
    mounted: async function() {
        await profileStore.load();
    },
    components: {
        Alert,
        IconSettings,
        IconVideo,
        IconUsers,
        IconServer,
        IconBrandDocker,
        IconBuildingBroadcastTower,
        PageFooter,
        TablerLoading,
        TablerBreadCrumb,
        IconNetwork,
    }
}
</script>
