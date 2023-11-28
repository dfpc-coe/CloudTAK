<template>
<div class='row'>
    <div class='col-12 border-light border-bottom'>
        <div class='modal-header px-0 mx-2'>
            <div class='modal-title'>Missions</div>
            <div class='btn-list'>
                <PlusIcon @click='$emit("create")' class='cursor-pointer' v-tooltip='"Create Mission"'/>
                <RefreshIcon v-if='!loading' @click='fetchMissions' class='cursor-pointer' v-tooltip='"Refresh"'/>
            </div>
        </div>
    </div>
    <div class='modal-body mx-3'>
        <TablerLoading v-if='loading' desc='Loading Missions'/>
        <Alert v-else-if='err' :err='err'/>
        <template v-else>
            <div
                @click='$emit("mission", mission)'
                :key='mission_it'
                v-for='(mission, mission_it) in list.data'
                class='cursor-pointer col-12 row py-2 hover rounded'
            >
                <div class='col-auto d-flex justify-content-center align-items-center'>
                    <LockIcon v-if='mission.passwordProtected'/>
                    <LockOpenIcon v-else/>
                </div>
                <div class='col-auto row'>
                    <div class='col-12'>
                        <span v-text='mission.name'/>
                    </div>
                    <div class='col-12'>
                        <span v-text='mission.createTime.replace(/T.*/, "")' class='text-secondary'/>
                        &nbsp;-&nbsp;
                        <span v-text='mission.contents.length + " Items"' class='text-secondary'/>
                    </div>
                </div>
            </div>
        </template>
    </div>
</div>
</template>

<script>
import {
    PlusIcon,
    LockIcon,
    LockOpenIcon,
    RefreshIcon,
} from 'vue-tabler-icons';
import Alert from '../util/Alert.vue';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'MissionList',
    data: function() {
        return {
            err: false,
            loading: true,
            list: {
                data: {}
            }
        }
    },
    mounted: async function() {
        await this.fetchMissions();
    },
    methods: {
        fetchMissions: async function() {
            try {
                this.loading = true;
                const url = window.stdurl('/api/marti/mission');
                url.searchParams.append('passwordProtected', 'true');
                this.list = await window.std(url);
            } catch (err) {
                this.err = err;
            }
            this.loading = false;
        }
    },
    components: {
        Alert,
        TablerLoading,
        RefreshIcon,
        PlusIcon,
        LockIcon,
        LockOpenIcon
    }
}
</script>
