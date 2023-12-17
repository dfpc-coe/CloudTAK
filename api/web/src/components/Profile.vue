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
                <div class='col-lg-12'>
                    <div class='card'>
                        <div class='row g-0'>
                            <div class="col-12 col-md-3 border-end">
                                <div class="card-body">
                                    <h4 class="subheader">Profile Sections</h4>
                                    <div class="list-group list-group-transparent">
                                        <span @click='$router.push(`/profile/groups`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "profile-groups",
                                            "cursor-pointer": $route.name !== "profile-groups"
                                        }'><IconAffiliate/><span class='mx-3'>Channels</span></span>
                                        <span @click='$router.push(`/profile/tokens`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "profile-tokens",
                                            "cursor-pointer": $route.name !== "profile-tokens"
                                        }'><IconRobot/><span class='mx-3'>API Tokens</span></span>
                                        <span @click='$router.push(`/profile/files`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "profile-files",
                                            "cursor-pointer": $route.name !== "profile-files"
                                        }'><IconFiles/><span class='mx-3'>Files</span></span>
                                        <span @click='$router.push(`/profile/jobs`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "profile-jobs",
                                            "cursor-pointer": $route.name !== "profile-jobs"
                                        }'><IconTransform/><span class='mx-3'>Jobs</span></span>
                                    </div>
                                </div>
                            </div>
                            <div class="col-12 col-md-9">
                                <router-view/>
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
import {
    TablerBreadCrumb
} from '@tak-ps/vue-tabler';
import {
    IconRobot,
    IconTransform,
    IconFiles,
    IconAffiliate
} from '@tabler/icons-vue';

export default {
    name: 'Profile',
    components: {
        IconRobot,
        PageFooter,
        IconTransform,
        IconAffiliate,
        IconFiles,
        TablerBreadCrumb
    }
}
</script>
