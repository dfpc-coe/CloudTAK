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
                                                <span class='px-2'>Protected</span>
                                                <label class='form-check form-switch'>
                                                    <input
                                                        v-model='layer.protected'
                                                        class='form-check-input'
                                                        type='checkbox'
                                                    >
                                                </label>
                                            </div>
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
                                            <TablerPillGroup
                                                v-model='type'
                                                :options='[
                                                    { value: "template", label: "Templated Creation" },
                                                    { value: "manual", label: "Manual Creation" }
                                                ]'
                                                :rounded='false'
                                                size='default'
                                                padding=''
                                                name='creation-type'
                                            >
                                                <template #option='{ option }'>
                                                    <IconTemplate
                                                        v-if='option.value === "template"'
                                                        class='me-2'
                                                        :size='20'
                                                        stroke='1'
                                                    />
                                                    <IconPencil
                                                        v-if='option.value === "manual"'
                                                        class='me-2'
                                                        :size='20'
                                                        stroke='1'
                                                    />
                                                    {{ option.label }}
                                                </template>
                                            </TablerPillGroup>
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

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { std, stdurl } from '../../std.ts';
import type { ETLLayer } from '../../types.ts';
import PageFooter from '../PageFooter.vue';
import LayerTemplateSelect from '../util/LayerTemplateSelect.vue';
import LayerTaskSelect from '../util/LayerTaskSelect.vue';
import {
    TablerBreadCrumb,
    TablerDelete,
    TablerInput,
    TablerLoading,
    TablerPillGroup
} from '@tak-ps/vue-tabler';
import {
    IconTemplate,
    IconPencil,
} from '@tabler/icons-vue';

interface LayerForm {
    name: string;
    description: string;
    task: string;
    enabled: boolean;
    logging: boolean;
    protected: boolean;
    [key: string]: unknown;
}

const route = useRoute();
const router = useRouter();

const type = ref('template');
const loading = ref({
    layer: true
});

const errors = ref<Record<string, string>>({
    name: '',
    task: '',
    description: '',
})

const template = ref<{ id?: number; [key: string]: unknown } | undefined>();

const layer = ref<LayerForm>({
    name: '',
    description: '',
    task: '',
    enabled: true,
    logging: false,
    protected: false,
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
    layer.value = await std(`/api/connection/${route.params.connectionid}/layer/${route.params.layerid}`) as LayerForm;
    loading.value.layer = false;
}

async function deleteLayer() {
    await std(`/api/connection/${route.params.connectionid}/layer/${route.params.layerid}`, {
        method: 'DELETE'
    });

    router.push(`/connection/${route.params.connectionid}/layer`);
}

async function create() {
    const fields = ['name', 'description'];

    if (type.value === "manual") fields.push('task');

    for (const field of fields) {
        errors.value[field] = !layer.value[field] ? 'Cannot be empty' : '';
    }
    for (const e in errors.value) if (errors.value[e]) return;

    loading.value.layer = true;

    let savedLayer: ETLLayer;

    try {
        let url: URL;
        if (route.params.layerid) {
            url = stdurl(`/api/connection/${route.params.connectionid}/layer/${route.params.layerid}`);
            savedLayer = await std(url, {
                method: 'PATCH',
                body: {
                    name: layer.value.name,
                    description: layer.value.description,
                    enabled: layer.value.enabled,
                    logging: layer.value.logging,
                    protected: layer.value.protected,
                }
            }) as ETLLayer;
        } else {
            url = stdurl(`/api/connection/${route.params.connectionid}/layer`);

            let body = JSON.parse(JSON.stringify(layer.value));
            if (type.value === "template" && template.value) {
                // These should be overwritten
                delete body.task;
                body = { ...template.value, ...body };
            }

            savedLayer = await std(url, { method: 'POST', body }) as ETLLayer;
        }

        loading.value.layer = false;

        router.push(`/connection/${route.params.connectionid}/layer/${savedLayer.id}`);
    } catch (err) {
        loading.value.layer = false;
        throw err;
    }
}
</script>
