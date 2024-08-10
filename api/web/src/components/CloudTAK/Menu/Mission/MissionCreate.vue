<template>
    <div class='col-12'>
        <TablerLoading
            v-if='loading.initial'
            desc='Loading Mission'
        />
        <template v-else>
            <div class='modal-header'>
                <div class='row'>
                    <div class='col-auto'>
                        <IconLock
                            v-if='mission.passwordProtected'
                            :size='32'
                            :stroke='1'
                        />
                        <IconLockOpen
                            v-else
                            :size='32'
                            :stroke='1'
                        />
                    </div>
                    <div class='col-auto row'>
                        <div class='col-12'>
                            <span>Create Mission</span>
                        </div>
                    </div>
                </div>
            </div>
            <TablerLoading
                v-if='loading.mission'
                desc='Saving Mission'
            />
            <TablerAlert
                v-else-if='err'
                :err='err'
            />
            <template v-else>
                <div class='modal-body row g-2'>
                    <TablerInput
                        v-model='mission.name'
                        label='Name'
                    />

                    <div class='col-12'>
                        <label class='px-2 w-100'>Groups (Channels)</label>
                        <div
                            class='mx-1 d-flex'
                            style='padding-right: 15px;'
                        >
                            <input
                                type='text'
                                class='form-control'
                                disabled
                                :value='mission.groups.length ? mission.groups.join(", ") : "None"'
                            >
                            <button
                                class='btn btn-sm'
                                @click='modal.groups = true'
                            >
                                <IconListSearch
                                    :size='32'
                                    :stroke='1'
                                    class='cursor-pointer mx-2'
                                />
                            </button>
                        </div>
                    </div>

                    <TablerInput
                        v-model='mission.password'
                        :disabled='!mission.passwordProtected'
                        type='password'
                        label='Password'
                    >
                        <TablerToggle
                            v-model='mission.passwordProtected'
                            label='Password Protected'
                        />
                    </TablerInput>

                    <label
                        class='subheader mt-3 cursor-pointer'
                        @click='advanced = !advanced'
                    >
                        <IconSquareChevronRight
                            v-if='!advanced'
                            :size='32'
                            :stroke='1'
                        />
                        <IconChevronDown
                            v-else
                            :size='32'
                            :stroke='1'
                        />
                        Advanced Options
                    </label>

                    <div
                        v-if='advanced'
                        class='col-12'
                    >
                        <div class='row g-2'>
                            <div class='col-12'>
                                <TablerEnum
                                    v-model='mission.role'
                                    label='Default Role'
                                    :options='["Read-Only", "Subscriber", "Owner"]'
                                />
                            </div>
                            <div class='col-12'>
                                <TablerInput
                                    v-model='mission.description'
                                    label='Description'
                                />
                            </div>
                        </div>
                    </div>

                    <div class='col-12 d-flex'>
                        <div class='ms-auto'>
                            <button
                                class='btn btn-primary'
                                @click='createMission'
                            >
                                Create Mission
                            </button>
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
import { std, stdurl } from '/src/std.ts';
import {
    IconLock,
    IconLockOpen,
    IconListSearch,
    IconSquareChevronRight,
    IconChevronDown,
} from '@tabler/icons-vue';
import GroupSelect from '../../../util/GroupSelectModal.vue';
import {
    TablerAlert,
    TablerInput,
    TablerEnum,
    TablerToggle,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'MissionCreate',
    components: {
        IconSquareChevronRight,
        IconChevronDown,
        GroupSelect,
        TablerAlert,
        TablerLoading,
        TablerInput,
        TablerEnum,
        TablerToggle,
        IconListSearch,
        IconLock,
        IconLockOpen
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

                const url = stdurl(`/api/marti/missions/${this.mission.name}`);

                const body = {
                    group: this.mission.groups,
                    description: this.mission.description || ''
                };

                if (this.mission.role === 'Subscriber') body.defaultRole = 'MISSION_SUBSCRIBER';
                if (this.mission.role === 'Read-Only') body.defaultRole = 'MISSION_READONLY_SUBSCRIBER';
                if (this.mission.role === 'Owner') body.defaultRole = 'MISSION_OWNER';

                if (this.mission.passwordProtected) body.password = this.mission.password;

                const res = await std(url, {
                    method: 'POST',
                    body
                });

                this.$emit('mission', res);
            } catch (err) {
                this.err = err;
            }
            this.loading.mission = false;
        }
    }
}
</script>
