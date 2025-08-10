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
            v-if='loading.layer'
            class='text-white'
            desc='Loading Layer'
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
                                    Layer <span v-text='layer.id' />
                                </h3>

                                <div class='ms-auto'>
                                    <div class='d-flex'>
                                        <div class='btn-list'>
                                            <div class='d-flex'>
                                                <span class='px-2'>Logging</span>
                                                <label class='form-check form-switch'>
                                                    <input
                                                        v-model='layer.logging'
                                                        class='form-check-input'
                                                        type='checkbox'
                                                    >
                                                </label>
                                            </div>
                                            <div class='d-flex'>
                                                <span class='px-2'>Enabled</span>
                                                <label class='form-check form-switch'>
                                                    <input
                                                        v-model='layer.enabled'
                                                        class='form-check-input'
                                                        type='checkbox'
                                                    >
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class='card-body'>
                                <div class='row row-cards'>
                                    <div class='col-md-12'>
                                        <TablerInput
                                            v-model='layer.name'
                                            label='Layer Name'
                                            :error='errors.name'
                                        />
                                    </div>
                                    <div class='col-md-12'>
                                        <TablerInput
                                            v-model='layer.description'
                                            label='Layer Description'
                                            :rows='6'
                                            :error='errors.description'
                                        />
                                    </div>
                                    <template v-if='!route.params.layerid'>
                                        <div class='col-12'>
                                            <div
                                                class='btn-group w-100'
                                                role='group'
                                            >
                                                <input
                                                    id='template'
                                                    type='radio'
                                                    class='btn-check'
                                                    name='creation-type'
                                                    autocomplete='off'
                                                    :checked='type === "template"'
                                                    @click='type = "template"'
                                                >
                                                <label
                                                    for='template'
                                                    type='button'
                                                    class='btn'
                                                ><IconTemplate
                                                    class='me-2'
                                                    :size='20'
                                                    :stoke='1'
                                                /> Templated Creation</label>

                                                <input
                                                    id='manual'
                                                    type='radio'
                                                    class='btn-check'
                                                    name='creation-type'
                                                    autocomplete='off'
                                                    :checked='type === "manual"'
                                                    @click='type = "manual"'
                                                >
                                                <label
                                                    for='manual'
                                                    type='button'
                                                    class='btn'
                                                ><IconPencil
                                                    class='me-2'
                                                    :size='20'
                                                    :stoke='1'
                                                /> Manual Creation</label>
                                            </div>
                                        </div>

                                        <template v-if='type === "template"'>
                                            <LayerTemplateSelect v-model='template' />
                                        </template>
                                        <template v-else-if='type === "manual"'>
                                            <LayerTaskSelect v-model='layer.task' />
                                        </template>
                                    </template>
                                    <div class='col-lg-12 d-flex'>
                                        <div v-if='route.params.layerid'>
                                            <TablerDelete
                                                label='Delete Layer'
                                                @delete='deleteLayer'
                                            />
                                        </div>
                                        <div class='ms-auto'>
                                            <a
                                                v-if='route.params.layerid'
                                                class='cursor-pointer btn btn-primary'
                                                @click='create'
                                            >Update Layer</a>
                                            <a
                                                v-else
                                                class='cursor-pointer btn btn-primary'
                                                @click='create'
                                            >Create Layer</a>
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
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { std, stdurl } from '../../std.ts';
import PageFooter from '../PageFooter.vue';
import LayerTemplateSelect from '../util/LayerTemplateSelect.vue';
import LayerTaskSelect from '../util/LayerTaskSelect.vue';
import {
    TablerBreadCrumb,
    TablerDelete,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconTemplate,
    IconPencil,
} from '@tabler/icons-vue';

const route = useRoute();
const router = useRouter();

const type = ref('template');
const loading = ref({
    layer: true
});

const errors = ref({
    name: '',
    task: '',
    description: '',
})

const template = ref(null);

const layer = ref({
    name: '',
    description: '',
    task: '',
    enabled: true,
    logging: false,
})

onMounted(async () => {
    if (route.params.layerid) {
        await fetch();
    } else {
        loading.value.layer = false;
    }
});

async function fetch() {
    loading.value.layer = true;
    layer.value = await std(`/api/connection/${route.params.connectionid}/layer/${route.params.layerid}`);
    loading.value.layer = false;
}

async function deleteLayer() {
    await std(`/api/connection/${route.params.connectionid}/layer/${route.params.layerid}`, {
        method: 'DELETE'
    });

    router.push(`/connection/${route.params.connectionid}/layer`);
}

async function create() {
    let fields =  ['name', 'description']

    if (type.value === "manual") fields.push('task');

    for (const field of fields) {
        errors.value[field] = !layer.value[field] ? 'Cannot be empty' : '';
    }
    for (const e in errors.value) if (errors.value[e]) return;

    loading.value.layer = true;

    let savedLayer;

    try {
        let url;
        if (route.params.layerid) {
            url = stdurl(`/api/connection/${route.params.connectionid}/layer/${route.params.layerid}`);
            savedLayer = await std(url, {
                method: 'PATCH',
                body: {
                    name: layer.value.name,
                    description: layer.value.description,
                    enabled: layer.value.enabled,
                    logging: layer.value.logging,
                }
            });
        } else {
            url = stdurl(`/api/connection/${route.params.connectionid}/layer`);

            savedLayer = JSON.parse(JSON.stringify(layer.value));

            let body = JSON.parse(JSON.stringify(layer.value));
            if (type.value === "template" && template.value) {
                // These should be overwritten
                delete body.task;
                body = { ...template.value, ...body };
            }

            savedLayer = await std(url, { method: 'POST', body });
        }

        loading.value.layer = false;

        router.push(`/connection/${route.params.connectionid}/layer/${savedLayer.id}`);
    } catch (err) {
        loading.value.layer = false;
        throw err;
    }
}
</script>
