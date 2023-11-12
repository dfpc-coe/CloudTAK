<template>
<div class='col-12'>
    <TablerLoading v-if='loading.initial' desc='Loading Mission'/>
    <template v-else>
        <div class='d-flex px-1 py-1'>
            <div class='row'>
                <div class='col-auto d-flex justify-content-center align-items-center mx-2'>
                    <LockIcon v-if='mission.passwordProtected'/>
                    <LockOpenIcon v-else/>
                </div>
                <div class='col-auto row'>
                    <div class='col-12'>
                        <span v-text='mission.name'/>
                    </div>
                    <div class='col-12'>
                        <span v-if='mission.createTime' v-text='mission.createTime.replace(/T.*/, "")' class='text-secondary'/>
                        <span v-if='mission.createTime'>&nbsp;-&nbsp;</span>
                        <span v-if='Array.isArray(mission.contents)' v-text='mission.contents.length + " Items"' class='text-secondary'/>
                    </div>
                </div>
            </div>
            <div class='ms-auto btn-list my-2' style='padding-right: 56px;'>
                <TablerDelete @delete='deleteMission' displaytype='icon'/>
                <PencilIcon class='cursor-pointer' v-tooltip='"Edit"'/>
                <RefreshIcon v-if='!loading.initial' @click='fetchMission' class='cursor-pointer' v-tooltip='"Refresh"'/>
            </div>
        </div>
        <TablerLoading v-if='loading.mission' desc='Loading Mission'/>
        <TablerLoading v-else-if='loading.delete' desc='Deleting Mission'/>
        <Alert v-else-if='err' :err='err'/>
        <template v-else-if='this.initial.passwordProtected && !password'>
            <div class='modal-body'>
                <div class='d-flex justify-content-center py-3'>
                    <LockIcon width='32' height='32' />
                </div>
                <h3 class='text-center'>Mission Locked</h3>
                <div class='col-12 d-flex pt-2'>
                    <TablerInput v-model='password' label='Mission Password' class='w-100'/>
                    <div class='ms-auto' style='padding-top: 28px; padding-left: 10px;'>
                        <button class='btn btn-primary'>Unlock Mission</button>
                    </div>
                </div>
            </div>
        </template>
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
                    <div @click='mode = "logs"' class='px-2 py-2' :class='{
                        "bg-blue-lt": mode === "logs",
                        "cursor-pointer": mode !== "logs"
                    }'><ArticleIcon/></div>
                </div>
                <div class="col-10 mx-2 my-2">
                    <template v-if='mode === "info"'>
                        <div class="datagrid-item pb-2">
                            <div class="datagrid-title">Created</div>
                            <div class="datagrid-content" v-text='mission.createTime'></div>
                        </div>
                        <div class="datagrid-item pb-2">
                            <div class="datagrid-title">Updated</div>
                            <div class="datagrid-content"></div>
                        </div>
                        <div class="datagrid-item pb-2">
                            <div class="datagrid-title">Subscribers</div>
                            <div class="datagrid-content"></div>
                        </div>
                        <div class="datagrid-item pb-2">
                            <div class="datagrid-title">Description</div>
                            <div class="datagrid-content" v-text='mission.description || "No Feed Description"'></div>
                        </div>
                    </template>
                    <template v-else-if='mode === "users"'>
                        <div class='col-12 my-2' :key='uid.createorUid' v-for='uid in mission.uids'>
                            <UserIcon/><span v-text='uid.details.callsign'/>
                        </div>
                    </template>
                    <template v-else-if='mode === "logs"'>
                        <TablerNone v-if='!mission.logs'/>
                        <pre v-text='mission.logs'/>
                    </template>
                </div>
            </div>
        </template>
    </template>
</div>
</template>

<script>
import {
    ArticleIcon,
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
    TablerNone,
    TablerDelete,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'MissionEdit',
    props: {
        initial: {
            type: Object
        }
    },
    data: function() {
        return {
            err: null,
            mode: 'general',
            password: '',
            loading: {
                initial: !this.initial.passwordProtected,
                mission: !this.initial.passwordProtected,
                delete: false 
            },
            mission: {
                name: this.initial.name || 'Unknown',
                passwordProtected: this.initial.passwordProtected,
            }
        }
    },
    mounted: async function() {
        if (!this.mission.passwordProtected) {
            await this.fetchMission();
        }
    },
    methods: {
        deleteMission: async function() {
            try {
                this.loading.delete = true;
                const url = window.stdurl(`/api/marti/missions/${this.mission.name}`);
                const list = await window.std(url, {
                    method: 'DELETE'
                });
                if (list.data.length !== 1) throw new Error('Mission Error');
                this.$emit('close');
            } catch (err) {
                this.err = err;
            }
            this.loading.delete = false;
        },
        fetchMission: async function() {
            try {
                this.loading.mission = true;
                const url = window.stdurl(`/api/marti/missions/${this.mission.name}`);
                url.searchParams.append('changes', 'true');
                url.searchParams.append('logs', 'true');
                const list = await window.std(url);
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
        TablerNone,
        Alert,
        ArticleIcon,
        InfoSquareIcon,
        UserIcon,
        UsersIcon,
        PencilIcon,
        TablerLoading,
        TablerDelete,
        TablerInput,
        RefreshIcon,
        LockIcon,
        LockOpenIcon
    }
}
</script>
