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
                                            :disabled='route.params.dataid'
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
                                        <GroupSelect
                                            v-model='data.mission_groups'
                                            :connection='route.params.connectionid'
                                        />
                                    </div>
                                    <div class='col-md-12'>
                                        <TablerEnum
                                            v-model='data.mission_role'
                                            label='Mission Default Role'
                                            :disabled='route.params.dataid || data.mission_diff'
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
                                        <div v-if='route.params.dataid'>
                                            <TablerDelete
                                                label='Delete Data'
                                                @delete='deleteData'
                                            />
                                        </div>
                                        <div class='ms-auto'>
                                            <a
                                                v-if='route.params.dataid'
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

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { std, stdurl } from '../../std.ts';
import PageFooter from '../PageFooter.vue';
import {
    TablerBreadCrumb,
    TablerInput,
    TablerToggle,
    TablerDelete,
    TablerEnum,
    TablerLoading
} from '@tak-ps/vue-tabler';
import GroupSelect from '../util/GroupSelect.vue';

const route = useRoute();
const router = useRouter();
const loading = ref({
    data: true,
});

const errors = ref({
    name: '',
    description: '',
});

const data = ref({
    name: '',
    auto_transform: true,
    mission_sync: true,
    mission_groups: [],
    mission_role: 'MISSION_READONLY_SUBSCRIBER',
    mission_diff: true,
    description: '',
});

watch(data.value, () => {
    if (!data.value.id && data.value.mission_diff) {
        data.value.mission_role = 'MISSION_READONLY_SUBSCRIBER';
    }
});

onMounted(async () => {
    if (route.params.dataid) {
        await fetch();
    } else {
        loading.value.data = false;
    }
});

async function fetch() {
    loading.value.data = true;
    data.value = await std(`/api/connection/${route.params.connectionid}/data/${route.params.dataid}`);
    loading.value.data = false;
}

async function deleteData() {
    await std(`/api/connection/${route.params.connectionid}/data/${route.params.dataid}`, {
        method: 'DELETE'
    });

    router.push(`/connection/${route.params.connectionid}/data`);
}

async function create() {
    for (const field of ['name', 'description']) {
        errors.value[field] = !data.value[field] ? 'Cannot be empty' : '';
    }
    for (const e in errors.value) if (errors.value[e]) return;

    loading.value.data = true;

    try {
        let url, method;
        const body = JSON.parse(JSON.stringify(data.value));

        if (route.params.dataid) {
            url = stdurl(`/api/connection/${route.params.connectionid}/data/${route.params.dataid}`);
            method = 'PATCH'
        } else {
            url = stdurl(`/api/connection/${route.params.connectionid}/data`);
            method = 'POST'
            body.connection = parseInt(route.params.connectionid);
        }

        const create = await std(url, { method, body });

        loading.value.data = false;

        router.push(`/connection/${route.params.connectionid}/data/${create.id}`);
    } catch (err) {
        loading.value.data = false;
        throw err;
    }
}
</script>
