<template>
<div>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$emit("close")' size='32' class='cursor-pointer'/>
            <div class='modal-title'>Missions</div>
            <div class='btn-list'>
                <IconPlus @click='$emit("create")' size='32' class='cursor-pointer' v-tooltip='"Create Mission"'/>
                <IconRefresh @click='fetchMissions' size='32' class='cursor-pointer' v-tooltip='"Refresh"'/>
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
            <div class='px-3 d-flex'>
                <div class='d-flex justify-content-center align-items-center'>
                    <IconLock v-if='mission.passwordProtected' size='32'/>
                    <IconLockOpen v-else size='32'/>
                </div>
                <div class='mx-2'>
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
                    <IconAccessPoint v-if='subscriptions.has(mission.guid)' v-tooltip='"Subscribed"' size='32' class='text-green'/>
                </div>
            </div>
        </div>
    </template>
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
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
import { useOverlayStore } from '/src/stores/overlays.ts';
const overlayStore = useOverlayStore();

export default {
    name: 'MissionList',
    data: function() {
        return {
            err: false,
            loading: true,
            subscriptions: overlayStore.subscriptions,
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
            await overlayStore.list();
            this.err = false;

            try {
                this.loading = true;
                const url = stdurl('/api/marti/mission');
                url.searchParams.append('passwordProtected', 'true');
                this.list = await std(url);
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
