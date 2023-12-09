<template>
<div>
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
                                            "active": $route.name === "layer-groups",
                                            "cursor-pointer": $route.name !== "layer-groups"
                                        }'><AffiliateIcon/><span class='mx-3'>Channels</span></span>
                                        <span @click='$router.push(`/profile/tokens`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "layer-tokens",
                                            "cursor-pointer": $route.name !== "layer-tokens"
                                        }'><RobotIcon/><span class='mx-3'>API Tokens</span></span>
                                        <span @click='$router.push(`/profile/files`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "layer-files",
                                            "cursor-pointer": $route.name !== "layer-files"
                                        }'><FilesIcon/><span class='mx-3'>Files</span></span>
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
    RobotIcon,
    FilesIcon,
    AffiliateIcon
} from 'vue-tabler-icons';

export default {
    name: 'Profile',
    components: {
        RobotIcon,
        PageFooter,
        AffiliateIcon,
        FilesIcon,
        TablerBreadCrumb
    }
}
</script>
