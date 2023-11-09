<template>
<div class='col-12'>
    <TablerLoading v-if='loading.initial' desc='Loading Mission'/>
    <template v-else>
        <div class='modal-header'>
            <div class='row'>
                <div class='col-auto'>
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
            <div class='btn-list'>
                <PencilIcon class='cursor-pointer'/>
                <RefreshIcon v-if='!loading.initial' @click='fetchMission' class='cursor-pointer'/>
            </div>
        </div>
        <TablerLoading v-if='loading.mission' desc='Loading Mission'/>
        <Alert v-else-if='err' :err='err'/>
        <template v-else>
            <div class='row g-0'>
                <div class="col-auto border-end">
                    <div @click='mode = "info"' class='px-2 py-2' :class='{
                        "bg-blue-lt": mode === "info",
                        "cursor-pointer": mode !== "info"
                    }'><InfoSquareIcon/></div>
                    <div @click='mode = "users"' class='px-2 py-2' :class='{
                        "bg-blue-lt": mode === "users",
                        "cursor-pointer": mode !== "users"
                    }'><UsersIcon/></div>
                </div>
                <div class="col-10 mx-2 my-2">
                    <template v-if='mode === "info"'>

                    </template>
                    <template v-else-if='mode === "users"'>
                        <div class='col-12 my-2' :key='uid.createorUid' v-for='uid in mission.uids'>
                            <UserIcon/><span v-text='uid.details.callsign'/>
                        </div>
                    </template>
                </div>
            </div>
        </template>
    </template>
</div>
</template>

<script>
import {
    LockIcon,
    InfoSquareIcon,
    UserIcon,
    UsersIcon,
    LockOpenIcon,
    PencilIcon,
    RefreshIcon,
} from 'vue-tabler-icons';
import Alert from '../util/Alert.vue';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'MissionEdit',
    props: {
        missionid: {
            type: String
        }
    },
    data: function() {
        return {
            err: null,
            mode: 'general',
            loading: {
                initial: true,
                mission: true
            },
            mission: {}
        }
    },
    mounted: async function() {
        await this.fetchMission();
    },
    methods: {
        fetchMission: async function() {
            try {
                this.loading.mission = true;
                const list = await window.std(`/api/marti/missions/${this.missionid}`);
                if (list.data.length !== 1) throw new Error('Mission Error');
                this.mission = list.data[0];
            } catch (err) {
                this.err = err;
            }
            this.loading.initial = false;
            this.loading.mission = false;
        }
    },
    components: {
        Alert,
        InfoSquareIcon,
        UserIcon,
        UsersIcon,
        PencilIcon,
        TablerLoading,
        RefreshIcon,
        LockIcon,
        LockOpenIcon
    }
}
</script>
