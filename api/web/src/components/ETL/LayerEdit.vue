<template>
    <div
        class='h-full w-full cloudtak-page'
        style='overflow: auto;'
    >
        <NavHeader title='Connections' />

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
                                        <LayerTaskSelect v-model='layer.task' />

                                        <div
                                            v-if='loading.capabilities'
                                            class='col-12'
                                        >
                                            <TablerLoading
                                                :inline='true'
                                                desc='Loading Task Capabilities'
                                            />
                                        </div>
                                        <div
                                            v-else-if='capabilities'
                                            class='col-12'
                                        >
                                            <LayerStaticCapabilities
                                                v-model='settings'
                                                :capabilities='capabilities'
                                                :disabled='false'
                                            />
                                        </div>
                                        <div
                                            v-else-if='layer.task'
                                            class='col-12'
                                        >
                                            <div class='small text-secondary'>
                                                This task version does not publish a Capabilities document - deployment and invocation settings can be configured after the Layer is created.
                                            </div>
                                        </div>
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
import { ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { server } from '../../std.ts';
import { validateSchedule } from '../../utils/schedule.ts';
import type { CapabilitySettings } from '../../base/capabilities.ts';
import { defaultCapabilitySettings } from '../../base/capabilities.ts';
import type { ETLLayer, ETLTaskCapabilities } from '../../types.ts';
import PageFooter from '../PageFooter.vue';
import NavHeader from '../util/NavHeader.vue';
import LayerTaskSelect from '../util/LayerTaskSelect.vue';
import LayerStaticCapabilities from './Layer/LayerStaticCapabilities.vue';
import {
    TablerBreadCrumb,
    TablerDelete,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';

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

const loading = ref({
    layer: true,
    capabilities: false
});

const errors = ref<Record<string, string>>({
    name: '',
    task: '',
    description: '',
    cron: '',
})

const capabilities = ref<ETLTaskCapabilities | null>(null);

const settings = ref<CapabilitySettings>(defaultCapabilitySettings());

const layer = ref<LayerForm>({
    name: '',
    description: '',
    task: '',
    enabled: true,
    logging: false,
    protected: false,
})

watch(() => layer.value.task, async (task) => {
    if (route.params.layerid) return;

    capabilities.value = null;
    settings.value = defaultCapabilitySettings();

    if (!task) return;

    const match = task.match(/^(.+)-v([0-9]+\.[0-9]+\.[0-9]+)$/);
    if (!match) return;

    loading.value.capabilities = true;

    try {
        const res = await server.GET('/api/task/raw/{:task}/version/{:version}', {
            params: {
                path: {
                    ':task': match[1],
                    ':version': match[2]
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        // Ignore the response if the user has since selected a different task or version
        if (layer.value.task !== task) return;

        // LayerStaticCapabilities seeds the settings from the document's defaults
        capabilities.value = res.data.capabilities;
    } finally {
        loading.value.capabilities = false;
    }
});

onMounted(async () => {
    if (route.params.layerid) {
        await fetch();
    } else {
        loading.value.layer = false;
    }
});

async function fetch() {
    loading.value.layer = true;
    const res = await server.GET('/api/connection/{:connectionid}/layer/{:layerid}', {
        params: {
            query: {
                alarms: true,
                download: false
            },
            path: {
                ':connectionid': Number(route.params.connectionid),
                ':layerid': Number(route.params.layerid)
            }
        }
    });
    if (res.error) throw new Error(res.error.message);
    layer.value = res.data as LayerForm;
    loading.value.layer = false;
}

async function deleteLayer() {
    const res = await server.DELETE('/api/connection/{:connectionid}/layer/{:layerid}', {
        params: {
            path: {
                ':connectionid': Number(route.params.connectionid),
                ':layerid': Number(route.params.layerid)
            }
        }
    });
    if (res.error) throw new Error(res.error.message);

    router.push(`/connection/${route.params.connectionid}/layer`);
}

async function create() {
    const fields = ['name', 'description'];

    if (!route.params.layerid) fields.push('task');

    for (const field of fields) {
        errors.value[field] = !layer.value[field] ? 'Cannot be empty' : '';
    }

    errors.value.cron = (
        !route.params.layerid
        && capabilities.value
        && settings.value.incoming
        && settings.value.schedule
    ) ? (validateSchedule(settings.value.cron) || '') : '';

    for (const e in errors.value) if (errors.value[e]) return;

    loading.value.layer = true;

    let savedLayer: ETLLayer;

    try {
        if (route.params.layerid) {
            const res = await server.PATCH('/api/connection/{:connectionid}/layer/{:layerid}', {
                params: {
                    query: { alarms: true },
                    path: {
                        ':connectionid': Number(route.params.connectionid),
                        ':layerid': Number(route.params.layerid)
                    }
                },
                body: {
                    name: layer.value.name,
                    description: layer.value.description,
                    enabled: layer.value.enabled,
                    logging: layer.value.logging,
                    protected: layer.value.protected,
                }
            });
            if (res.error) throw new Error(res.error.message);
            savedLayer = res.data as ETLLayer;
        } else {
            const body = JSON.parse(JSON.stringify(layer.value));
            body.memory = Number(settings.value.memory);
            body.timeout = Number(settings.value.timeout);

            if (capabilities.value) {
                const granted = Object.keys(settings.value.permissions)
                    .filter((resource) => settings.value.permissions[resource]);
                body.permissions = granted;

                if (settings.value.incoming && capabilities.value.invocations.incoming) {
                    body.incoming = {
                        cron: settings.value.schedule ? settings.value.cron : null,
                        webhooks: settings.value.webhooks
                    };
                }

                if (settings.value.outgoing && capabilities.value.invocations.outgoing) {
                    body.outgoing = {};
                }
            }

            const res = await server.POST('/api/connection/{:connectionid}/layer', {
                params: {
                    query: { alarms: true },
                    path: {
                        ':connectionid': Number(route.params.connectionid)
                    }
                },
                body
            });
            if (res.error) throw new Error(res.error.message);
            savedLayer = res.data as ETLLayer;
        }

        loading.value.layer = false;

        router.push(`/connection/${route.params.connectionid}/layer/${savedLayer.id}`);
    } catch (err) {
        loading.value.layer = false;
        throw err;
    }
}
</script>
