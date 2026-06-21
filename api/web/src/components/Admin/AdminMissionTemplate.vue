<template>
    <div>
        <div class='card-header'>
            <h1
                class='card-title'
            />

            <h1 class='card-title d-flex align-items-center'>
                <TablerIconButton
                    title='Back to List'
                    @click='router.push(`/admin/templates`)'
                >
                    <IconCircleArrowLeft
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <span
                    class='ms-2'
                    v-text='route.params.template === "new" ? "New Template": template.name'
                />
            </h1>

            <div class='ms-auto btn-list'>
                <TablerDelete
                    v-if='route.params.template !== "new" && disabled'
                    displaytype='icon'
                    @delete='deleteTemplate'
                />
                <TablerIconButton
                    v-if='disabled'
                    title='Edit Template'
                    @click='disabled = false'
                >
                    <IconPencil
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
        <div class='card-body'>
            <TablerLoading
                v-if='loading'
                desc='Loading Template'
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <template v-else-if='!disabled'>
                <div class='row g-2'>
                    <div class='col-12'>
                        <TablerInput
                            v-model='template.name'
                            label='Name'
                        />
                    </div>
                    <div class='col-12'>
                        <TablerInput
                            v-model='template.description'
                            label='Description'
                        />
                    </div>
                    <div class='col-12'>
                        <label class='form-label mx-2'>Default Keywords</label>
                        <Keywords
                            :keywords='template.keywords'
                            :relevant='[]'
                            placeholder='Default Keywords'
                            @update:keywords='template.keywords = $event'
                        />
                    </div>
                    <div class='col-12'>
                        <TablerUploadLogo
                            v-model='template.icon'
                            label='Template Logo'
                        />
                    </div>
                    <div class='col-12 d-flex'>
                        <div class='ms-auto'>
                            <button
                                class='btn btn-primary'
                                @click='saveTemplate'
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </template>
            <template v-else>
                <div class='d-flex'>
                    <div
                        v-if='template.icon'
                        class='me-4'
                    >
                        <img
                            :src='template.icon'
                            class='rounded border p-2 bg-white shadow-sm'
                            style='width: 128px; height: 128px; object-fit: contain;'
                        >
                    </div>
                    <div class='flex-fill'>
                        <label class='form-label'>Description</label>
                        <div class='text-muted'>
                            {{ template.description || 'No description provided.' }}
                        </div>

                        <div class='col-12 mt-1'>
                            <label class='form-label'>Default Keywords</label>
                            <Keywords
                                :keywords='template.keywords'
                            />
                        </div>
                    </div>
                </div>

                <div class='mt-3'>
                    <div class='d-flex align-items-center mb-2'>
                        <div
                            class='btn-group btn-group-sm'
                            role='group'
                        >
                            <button
                                type='button'
                                class='btn'
                                :class='tab === "logs" ? "btn-secondary" : "btn-outline-secondary"'
                                @click='tab = "logs"'
                            >
                                Logs
                            </button>
                            <button
                                type='button'
                                class='btn'
                                :class='tab === "palettes" ? "btn-secondary" : "btn-outline-secondary"'
                                @click='tab = "palettes"'
                            >
                                Palettes
                            </button>
                        </div>
                        <div class='ms-auto'>
                            <TablerIconButton
                                v-if='tab === "logs"'
                                title='Create Log'
                                @click='router.push(`/admin/template/${route.params.template}/log/new`)'
                            >
                                <IconPlus
                                    :size='20'
                                    stroke='1'
                                />
                            </TablerIconButton>
                            <TablerIconButton
                                v-else
                                title='Create Palette'
                                @click='createPalette'
                            >
                                <IconPlus
                                    :size='20'
                                    stroke='1'
                                />
                            </TablerIconButton>
                        </div>
                    </div>

                    <template v-if='tab === "logs"'>
                        <TablerNone
                            v-if='!template.logs || !template.logs.length'
                            label='No Mission Template Logs'
                            :create='false'
                        />
                        <div
                            v-else
                            class='card'
                        >
                            <div class='table-responsive'>
                                <table class='table table-vcenter card-table table-hover'>
                                    <thead>
                                        <tr>
                                            <th />
                                            <th>Name</th>
                                            <th>Keywords</th>
                                            <th>Created</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr
                                            v-for='log in template.logs'
                                            :key='log.id'
                                            class='cursor-pointer'
                                            tabindex='0'
                                            @keyup.enter='stdclick(router, $event, `/admin/template/${route.params.template}/log/${log.id}`)'
                                            @click='stdclick(router, $event, `/admin/template/${route.params.template}/log/${log.id}`)'
                                        >
                                            <td class='w-1'>
                                                <div
                                                    class='d-flex justify-content-center align-items-center'
                                                    style='width: 32px; height: 32px;'
                                                >
                                                    <img
                                                        v-if='log.icon'
                                                        :src='log.icon'
                                                        style='max-width: 100%; max-height: 100%; object-fit: contain;'
                                                        alt='Log Icon'
                                                    >
                                                </div>
                                            </td>
                                            <td v-text='log.name' />
                                            <td>
                                                <Keywords :keywords='log.keywords' />
                                            </td>
                                            <td>
                                                <TablerEpoch :date='log.created' />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </template>

                    <template v-else>
                        <TablerLoading
                            v-if='paletteLoading'
                            desc='Loading Palettes'
                        />
                        <TablerAlert
                            v-else-if='paletteError'
                            :err='paletteError'
                        />
                        <TablerNone
                            v-else-if='!palettes.items.length'
                            label='No Palettes'
                            :create='false'
                        />
                        <div
                            v-else
                            class='card'
                        >
                            <div class='table-responsive'>
                                <table class='table table-vcenter card-table table-hover'>
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Features</th>
                                            <th>Created</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr
                                            v-for='p in palettes.items'
                                            :key='p.uuid'
                                            class='cursor-pointer'
                                            tabindex='0'
                                            @keyup.enter='stdclick(router, $event, `/admin/template/${route.params.template}/palette/${p.uuid}`)'
                                            @click='stdclick(router, $event, `/admin/template/${route.params.template}/palette/${p.uuid}`)'
                                        >
                                            <td v-text='p.name' />
                                            <td v-text='p.features.length' />
                                            <td>
                                                <TablerEpoch :date='p.created' />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </template>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { v4 as randomUUID } from 'uuid';
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { server, stdclick } from '../../../src/std.ts';
import type { MissionTemplate, PaletteList } from '../../../src/types.ts';
import Keywords from '../CloudTAK/util/Keywords.vue';
import {
    TablerInput,
    TablerAlert,
    TablerDelete,
    TablerIconButton,
    TablerLoading,
    TablerEpoch,
    TablerNone,
    TablerUploadLogo
} from '@tak-ps/vue-tabler';
import {
    IconCircleArrowLeft,
    IconPencil,
    IconPlus
} from '@tabler/icons-vue'

const route = useRoute();
const router = useRouter();

const error = ref<Error | undefined>();
const disabled = ref(true);
const loading = ref(true);

const tab = ref<'logs' | 'palettes'>('logs');

const paletteLoading = ref(false);
const paletteError = ref<Error | undefined>();
const palettes = ref<PaletteList>({ total: 0, items: [] });

const template = ref<MissionTemplate>({
    id: randomUUID(),
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    name: '',
    icon: '',
    description: '',
    keywords: [],
    logs: []
});

onMounted(async () => {
    if (route.params.template !== "new") {
        await fetchTemplate();
        await fetchPalettes();
    } else {
        disabled.value = false
        loading.value = false;
    }
});

async function saveTemplate() {
    loading.value = true;

    try {
        if (route.params.template === "new") {
            const res = await server.POST(`/api/template/mission`, {
                body: template.value
            });

            if (res.error) {
                loading.value = false;
                error.value = new Error(res.error.message);
                return;
            }

            if (res.data) template.value = { ...res.data, logs: template.value.logs };

            disabled.value = true;
            router.push(`/admin/template/${template.value.id}`);
        } else {
            const res = await server.PATCH(`/api/template/mission/{:mission}`, {
                params: {
                    path: {
                        ":mission": String(route.params.template)
                    }
                },
                body: template.value
            });

            if (res.error) {
                loading.value = false;
                error.value = new Error(res.error.message);
                return;
            }

            if (res.data) template.value = { ...res.data, logs: template.value.logs };

            disabled.value = true;
        }
        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function deleteTemplate() {
    loading.value = true;

    try {
        const res = await server.DELETE(`/api/template/mission/{:mission}`, {
            params: {
                path: {
                    ":mission": String(route.params.template)
                }
            }
        });

        if (res.error) {
            loading.value = false;
            error.value = new Error(res.error.message);
            return;
        }

        router.push('/admin/templates');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function fetchTemplate() {
    loading.value = true;
    try {
        const res = await server.GET(`/api/template/mission/{:mission}`, {
            params: {
                path: {
                    ":mission": String(route.params.template)
                }
            }
        });
        if (res.error) throw new Error(res.error.message);
        if (res.data) template.value = res.data;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
}

async function fetchPalettes() {
    paletteLoading.value = true;
    paletteError.value = undefined;
    try {
        const res = await server.GET(`/api/template/mission/{:mission}/palette`, {
            params: {
                query: { limit: 100, page: 0, order: 'asc', sort: 'name', filter: '' },
                path: { ':mission': String(route.params.template) }
            }
        });

        if (res.error) throw new Error(res.error.message);
        palettes.value = res.data as unknown as PaletteList;
    } catch (err) {
        paletteError.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        paletteLoading.value = false;
    }
}

async function createPalette() {
    try {
        const res = await server.POST(`/api/template/mission/{:mission}/palette`, {
            params: { path: { ':mission': String(route.params.template) } },
            body: { name: 'New Palette' }
        });

        if (res.error) throw new Error(res.error.message);
        router.push(`/admin/template/${route.params.template}/palette/${res.data.uuid}`);
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>
