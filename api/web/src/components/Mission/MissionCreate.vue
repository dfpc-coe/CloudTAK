<template>
<div class='col-12'>
    <TablerLoading v-if='loading.initial' desc='Loading Mission'/>
    <template v-else>
        <div class='modal-header'>
            <div class='row'>
                <div class='col-auto'>
                    <IconLock v-if='mission.passwordProtected'/>
                    <IconLockOpen v-else/>
                </div>
                <div class='col-auto row'>
                    <div class='col-12'>
                        <span>Create Mission</span>
                    </div>
                </div>
            </div>
        </div>
        <TablerLoading v-if='loading.mission' desc='Saving Mission'/>
        <Alert v-else-if='err' :err='err'/>
        <template v-else>
            <div class='modal-body row g-2'>
                <TablerInput label='Name' v-model='mission.name'/>

                <div class='col-12'>
                    <label class='px-2 w-100'>Groups (Channels)</label>
                    <div class='mx-1 d-flex' style='padding-right: 15px;'>
                        <input type='text' class='form-control' disabled :value='mission.groups.length ? mission.groups.join(", ") : "None"'/>
                        <button @click='modal.groups = true' class='btn btn-sm'><IconListSearch class='cursor-pointer mx-2'/></button>
                    </div>
                </div>

                <TablerInput :disabled='!mission.passwordProtected' type='password' label='Password' v-model='mission.password'>
                    <TablerToggle label='Password Protected' v-model='mission.passwordProtected'/>
                </TablerInput>

                <label @click='advanced = !advanced' class='subheader mt-3 cursor-pointer'>
                    <IconSquareChevronRight v-if='!advanced'/>
                    <IconChevronDown v-else/>
                    Advanced Options
                </label>

                <div v-if='advanced' class='col-12'>
                    <div class='row g-2'>
                        <div class='col-12'>
                            <TablerEnum label='Default Role' v-model='mission.role' :options='["Read-Only", "Subscriber", "Owner"]'/>
                        </div>
                        <div class='col-12'>
                            <TablerInput label='Description' v-model='mission.description'/>
                        </div>
                    </div>
                </div>

                <div class='col-12 d-flex'>
                    <div class='ms-auto'>
                        <button @click='createMission' class='btn btn-primary'>Create Mission</button>
                    </div>
                </div>
            </div>
        </template>
    </template>

    <GroupSelect
        v-if='modal.groups'
        v-model='mission.groups'
        @close='modal.groups = false'
    />
</div>
</template>

<script>
import {
    IconLock,
    IconLockOpen,
    IconListSearch,
    IconSquareChevronRight,
    IconChevronDown,
} from '@tabler/icons-vue';
import GroupSelect from '../util/GroupSelectModal.vue';
import Alert from '../util/Alert.vue';
import {
    TablerNone,
    TablerInput,
    TablerEnum,
    TablerToggle,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'MissionCreate',
    props: {
        connection: {
            type: Number
        }
    },
    data: function() {
        return {
            err: null,
            loading: {
                mission: false,
            },
            modal: {
                groups: false
            },
            advanced: false,
            mission: {
                name: '',
                passwordProtected: false,
                role: 'Subscriber',
                description: '',
                groups: [],
                hashtags: ''
            }
        }
    },
    methods: {
        createMission: async function() {
            this.loading.mission = true;
            try {
                this.loading.mission = true;

                const url = window.stdurl(`/api/marti/missions/${this.mission.name}`);

                if (this.mission.role === 'Subscriber') url.searchParams.append('defaultRole', 'MISSION_SUBSCRIBER');
                if (this.mission.role === 'Read-Only') url.searchParams.append('defaultRole', 'MISSION_READONLY_SUBSCRIBER');
                if (this.mission.role === 'Owner') url.searchParams.append('defaultRole', 'MISSION_OWNER');

                url.searchParams.append('group', this.mission.groups.join(','));
                url.searchParams.append('description', this.mission.description);
                if (this.mission.passwordProtected) url.searchParams.append('password', this.mission.password);
                if (this.connection) url.searchParams.append('connection', this.connection);

                const res = await window.std(url, {
                    method: 'POST',
                });

                this.$emit('mission', res.data[0]);
            } catch (err) {
                this.err = err;
            }
            this.loading.mission = false;
        }
    },
    components: {
        IconSquareChevronRight,
        IconChevronDown,
        GroupSelect,
        TablerNone,
        Alert,
        TablerLoading,
        TablerInput,
        TablerEnum,
        TablerToggle,
        IconListSearch,
        IconLock,
        IconLockOpen
    }
}
</script>
