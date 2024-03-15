<template>
<div>
    <div class='page-wrapper'>
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col d-flex">
                        <TablerBreadCrumb/>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div class="col-lg-12">
                    <div class='card'>
                        <div class='row g-0'>
                            <div class="col-12 col-md-3 border-end">
                                <div class="card-body">
                                    <h4 class="subheader">CloudTAK Admin</h4>
                                    <div class="list-group list-group-transparent">
                                        <span @click='$router.push(`/admin/server`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "admin-server",
                                            "cursor-pointer": $route.name !== "admin-server"
                                        }'><IconServer size='32'/><span class='mx-3'>TAK Server</span></span>
                                        <span @click='$router.push(`/admin/task`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "admin-task",
                                            "cursor-pointer": $route.name !== "admin-task"
                                        }'><IconBrandDocker size='32'/><span class='mx-3'>ETL Tasks</span></span>
                                        <span @click='$router.push(`/admin/layer`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "admin-layer",
                                            "cursor-pointer": $route.name !== "admin-layer"
                                        }'><IconBuildingBroadcastTower size='32'/><span class='mx-3'>Layers</span></span>
                                    </div>
                                </div>
                            </div>
                            <div class="col-12 col-md-9 position-relative">
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

    <PageFooter/>
</div>
</template>

<script>
import PageFooter from './PageFooter.vue';
import timeDiff from '../timediff.js';
import {
    TablerModal,
    TablerLoading,
    TablerMarkdown,
    TablerBreadCrumb,
} from '@tak-ps/vue-tabler'
import {
    IconServer,
    IconBrandDocker,
    IconBuildingBroadcastTower,
} from '@tabler/icons-vue'

export default {
    name: 'Admin',
    components: {
        IconServer,
        IconBrandDocker,
        IconBuildingBroadcastTower,
        PageFooter,
        TablerLoading,
        TablerBreadCrumb,
    }
}
</script>
