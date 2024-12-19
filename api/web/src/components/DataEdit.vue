<template>
    <div style='overflow: auto;'>
        <div class='page-wrapper'>
            <div class='page-header d-print-none'>
                <div class='container-xl'>
                    <div class='row g-2 align-items-center'>
                        <div class='col d-flex text-white'>
                            <TablerBreadCrumb />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <TablerLoading
            v-if='loading.data'
            class='text-white'
            desc='Loading Data'
        />
        <div
            v-else
            class='page-body'
        >
            <div class='container-xl'>
                <div class='row row-deck row-cards'>
                    <div class='col-lg-12'>
                        <div class='card'>
                            <div class='card-header'>
                                <h3 class='card-title'>
                                    Data <span v-text='data.id' />
                                </h3>
                            </div>
                            <div class='card-body'>
                                <div class='row row-cards'>
                                    <div class='col-md-12'>
                                        <TablerInput
                                            v-model='data.name'
                                            label='Data Name'
                                            description='The human readable name of the Data Layer'
                                            :disabled='$route.params.dataid'
                                            :error='errors.name'
                                        />
                                    </div>
                                    <div class='col-md-12'>
                                        <TablerToggle
                                            v-model='data.auto_transform'
                                            label='Auto Transform'
                                            description='If Enabled, Assets uploaded to the Data package will be automatically transformed into Cloud & TAK Native formats'
                                        />
                                    </div>
                                    <div class='col-md-12'>
                                        <TablerInput
                                            v-model='mission_groups'
                                            label='Mission Sync Groups'
                                            description='Choose which TAK Channels this Data Sync should be availiable in'
                                            disabled
                                        >
                                            <IconSettings
                                                v-if='!$route.params.dataid'
                                                :size='32'
                                                :stroke='1'
                                                class='cursor-pointer'
                                                @click='modal = true'
                                            />
                                        </TablerInput>

                                        <GroupSelectModal
                                            v-if='modal'
                                            v-model='data.mission_groups'
                                            :connection='$route.params.connectionid'
                                            @close='modal = false'
                                        />
                                    </div>
                                    <div class='col-md-12'>
                                        <TablerEnum
                                            v-model='data.mission_role'
                                            label='Mission Default Role'
                                            :disabled='$route.params.dataid || data.mission_diff'
                                            description='The Default role assigned to subscribers to the mission'
                                            :options='["MISSION_OWNER", "MISSION_SUBSCRIBER", "MISSION_READONLY_SUBSCRIBER"]'
                                        />
                                    </div>
                                    <div class='col-md-12'>
                                        <TablerToggle
                                            v-model='data.mission_sync'
                                            label='Mission Sync'
                                            description='If Enabled, Assets will be uploaded to the Mission'
                                        />
                                    </div>
                                    <div class='col-md-12'>
                                        <TablerToggle
                                            v-model='data.mission_diff'
                                            label='Mission Layer Diff'
                                            description='
                                            If Enabled only a single layer will be allowed to be associated with the data sync
                                            and CoTs submitted will be diff against existing CoTs, with CoTs not in each new
                                            FeatureSet being removed from the Mission Sync
                                        '
                                        />
                                    </div>
                                    <div class='col-md-12'>
                                        <TablerInput
                                            v-model='data.description'
                                            label='Data Description'
                                            description='The human readable description of the Data Layer'
                                            :rows='6'
                                            :error='errors.description'
                                        />
                                    </div>
                                    <div class='d-flex'>
                                        <div v-if='$route.params.dataid'>
                                            <TablerDelete
                                                label='Delete Data'
                                                @delete='deleteData'
                                            />
                                        </div>
                                        <div class='ms-auto'>
                                            <a
                                                v-if='$route.params.dataid'
                                                class='cursor-pointer btn btn-primary'
                                                @click='create'
                                            >Update Data</a>
                                            <a
                                                v-else
                                                class='cursor-pointer btn btn-primary'
                                                @click='create'
                                            >Create Data</a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <PageFooter />
    </div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import PageFooter from './PageFooter.vue';
import {
    TablerBreadCrumb,
    TablerInput,
    TablerToggle,
    TablerDelete,
    TablerEnum,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconSettings,
} from '@tabler/icons-vue'
import GroupSelectModal from './util/GroupSelectModal.vue';

export default {
    name: 'DataEdit',
    components: {
        IconSettings,
        PageFooter,
        GroupSelectModal,
        TablerBreadCrumb,
        TablerEnum,
        TablerToggle,
        TablerDelete,
        TablerInput,
        TablerLoading
    },
    data: function() {
        return {
            modal: false,
            mission_groups: 'All Groups', // Updated by watcher
            loading: {
                data: true,
            },
            errors: {
                name: '',
                description: '',
            },
            data: {
                name: '',
                auto_transform: true,
                mission_sync: true,
                mission_groups: [],
                mission_role: 'MISSION_READONLY_SUBSCRIBER',
                mission_diff: true,
                description: '',
            }
        }
    },
    watch: {
        'data.mission_groups': {
            deep: true,
            handler: function() {
                this.mission_groups = this.data.mission_groups.length === 0 ? "All Groups" : this.data.mission_groups.join(",");
            }
        },
        'data.mission_diff': function() {
            if (!this.data.id && this.data.mission_diff) {
                this.data.mission_role = 'MISSION_READONLY_SUBSCRIBER';
            }
        }
    },
    mounted: async function() {
        if (this.$route.params.dataid) {
            await this.fetch();
        } else {
            this.loading.data = false;
        }
    },
    methods: {
        fetch: async function() {
            this.loading.data = true;
            this.data = await std(`/api/connection/${this.$route.params.connectionid}/data/${this.$route.params.dataid}`);
            this.loading.data = false;
        },
        deleteData: async function() {
            await std(`/api/connection/${this.$route.params.connectionid}/data/${this.$route.params.dataid}`, {
                method: 'DELETE'
            });

            this.$router.push(`/connection/${this.$route.params.connectionid}/data`);
        },
        create: async function() {
            for (const field of ['name', 'description']) {
                this.errors[field] = !this.data[field] ? 'Cannot be empty' : '';
            }
            for (const e in this.errors) if (this.errors[e]) return;

            this.loading.data = true;

            try {
                let url, method;
                const body = JSON.parse(JSON.stringify(this.data));

                if (this.$route.params.dataid) {
                    url = stdurl(`/api/connection/${this.$route.params.connectionid}/data/${this.$route.params.dataid}`);
                    method = 'PATCH'
                } else {
                    url = stdurl(`/api/connection/${this.$route.params.connectionid}/data`);
                    method = 'POST'
                    body.connection = parseInt(this.$route.params.connectionid);
                }

                const create = await std(url, { method, body });

                this.loading.data = false;

                this.$router.push(`/connection/${this.$route.params.connectionid}/data/${create.id}`);
            } catch (err) {
                this.loading.data = false;
                throw err;
            }
        }
    }
}
</script>
