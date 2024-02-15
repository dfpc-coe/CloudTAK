<template>
<div>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$emit("close")' class='cursor-pointer'/>
            <div class='modal-title'>Missions</div>
            <div class='btn-list' v-if='!loading'>
                <IconPlus @click='$emit("create")' class='cursor-pointer' v-tooltip='"Create Mission"'/>
                <IconRefresh @click='fetchMissions' class='cursor-pointer' v-tooltip='"Refresh"'/>
            </div>
        </div>
    </div>
    <TablerLoading v-if='loading' desc='Loading Missions'/>
    <TablerNone v-else-if='!list.data.length' label='Missions' :create='false'/>
    <Alert v-else-if='err' :err='err'/>
    <template v-else>
        <div
            @click='$emit("mission", mission)'
            :key='mission_it'
            v-for='(mission, mission_it) in list.data'
            class='cursor-pointer col-12 py-2 hover-dark'
        >
            <div class='row px-3'>
                <div class='col-auto d-flex justify-content-center align-items-center'>
                    <IconLock v-if='mission.passwordProtected'/>
                    <IconLockOpen v-else/>
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
                <div class='col-auto ms-auto align-items-center d-flex'>
                    <IconAccessPoint v-if='subscriptions.has(mission.guid)' v-tooltip='"Subscribed"' class='text-green'/>
                </div>
            </div>
        </div>
    </template>
</div>
</template>

<script>
import {
    IconPlus,
    IconLock,
    IconLockOpen,
    IconAccessPoint,
    IconRefresh,
    IconCircleArrowLeft,
} from '@tabler/icons-vue';
import Alert from '../../util/Alert.vue';
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';
import { useSubStore } from '/src/stores/subscription.js';
const subStore = useSubStore();

export default {
    name: 'MissionList',
    data: function() {
        return {
            err: false,
            loading: true,
            subscriptions: subStore.subscriptions,
            list: {
                data: {}
            }
        }
    },
    mounted: async function() {
        await subStore.list();
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
        TablerNone,
        TablerLoading,
        IconCircleArrowLeft,
        IconAccessPoint,
        IconRefresh,
        IconPlus,
        IconLock,
        IconLockOpen
    }
}
</script>
