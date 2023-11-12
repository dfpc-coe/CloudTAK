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
                <TablerInput :disabled='!mission.passwordProtected' type='password' label='Password' v-model='mission.password'>
                    <TablerToggle label='Password Protected' v-model='mission.passwordProtected'/>
                </TablerInput>

                <label @click='advanced = !advanced' class='subheader mt-3 cursor-pointer'>
                    <SquareChevronRightIcon v-if='!advanced'/>
                    <ChevronDownIcon v-else/>
                    Advanced Options
                </label>

                <div v-if='advanced' class='col-12'>
                    <TablerEnum label='Default Role' v-model='mission.role' :options='["Read-Only", "Subscriber", "Owner"]'/>
                    <TablerInput label='Description' v-model='mission.name'/>
                    <TablerInput label='Hashtags' v-model='mission.hashtags'/>
                </div>

                <div class='col-12 d-flex'>
                    <div class='ms-auto'>
                        <button @click='createMission' class='btn btn-primary'>Create Mission</button>
                    </div>
                </div>
            </div>
        </template>
    </template>
</div>
</template>

<script>
import {
    LockIcon,
    LockOpenIcon,
    SquareChevronRightIcon,
    ChevronDownIcon,
} from 'vue-tabler-icons';
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
    data: function() {
        return {
            err: null,
            loading: {
                mission: false,
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

                const res = window.std(url, {
                    method: 'POST',
                });

                const list = await window.std(url);
            } catch (err) {
                this.err = err;
            }
            this.loading.mission = false;
        }
    },
    components: {
        SquareChevronRightIcon,
        ChevronDownIcon,
        TablerNone,
        Alert,
        TablerLoading,
        TablerInput,
        TablerEnum,
        TablerToggle,
        LockIcon,
        LockOpenIcon
    }
}
</script>
