<template>
    <MenuTemplate name='Import'>
        <template #buttons>
            <div class='d-flex align-items-center gap-2'>
                <TablerDelete
                    v-if='imported && (imported.status === "Fail" || imported.status === "Success")'
                    displaytype='icon'
                    @delete='deleteImport'
                />
                <TablerIconButton
                    title='Download File'
                    @click='downloadImport'
                >
                    <IconDownload
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerRefreshButton
                    :loading='loading.initial'
                    @click='fetch(true)'
                />
            </div>
        </template>
        <template #default>
            <TablerAlert
                v-if='error'
                title='Import Error'
                :err='error'
            />
            <TablerLoading v-else-if='!imported || loading.initial' />
            <div
                v-else
                class='container-fluid px-2 px-sm-3 py-4'
            >
                <div class='row gy-3 gx-0 gx-lg-3'>
                    <div class='col-12'>
                        <div class='card h-100 bg-dark text-white border border-light-subtle shadow-sm'>
                            <div class='card-body d-flex flex-column gap-4'>
                                <div class='d-flex align-items-center gap-3'>
                                    <div class='flex-grow-1'>
                                        <p class='text-uppercase text-white-50 small mb-1'>
                                            Import
                                        </p>
                                        <div class='d-flex align-items-center gap-3'>
                                            <Status
                                                :dark='true'
                                                :status='imported.status'
                                            />
                                            <h2
                                                class='h4 mb-0 text-break'
                                                v-text='imported.name'
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div class='row gy-3 gx-0 gx-sm-3'>
                                    <div class='col-12'>
                                        <small class='text-uppercase text-white-50 d-block mb-1'>Import Type</small>
                                        <p
                                            class='text-start text-white p-0 text-decoration-none text-break'
                                            v-text='imported.source + ": " + imported.source_id'
                                        />
                                    </div>

                                    <div class='col-12 col-lg-6'>
                                        <small class='text-uppercase text-white-50 d-block'>Created</small>
                                        <p
                                            class='text-white mb-0 text-break'
                                            v-text='timeDiff(imported.created)'
                                        />
                                    </div>
                                    <div class='col-12 col-lg-6'>
                                        <small class='text-uppercase text-white-50 d-block'>Updated</small>
                                        <p
                                            class='text-white mb-0 text-break'
                                            v-text='timeDiff(imported.updated)'
                                        />
                                    </div>
                                    
                                    <div
                                        v-if='imported.status === "Empty"'
                                        class='col-12'
                                    >
                                        <TablerNone :create='false' />
                                    </div>

                                    <div
                                        v-else-if='loading.run'
                                        class='col-12'
                                    >
                                        <TablerLoading desc='Running Import' />
                                    </div>

                                    <div
                                        v-else-if='imported.status === "Fail"'
                                        class='col-12'
                                    >
                                        <div
                                            class='alert alert-danger d-flex align-items-center'
                                            role='alert'
                                        >
                                            <IconAlertTriangle class='me-2' />
                                            <div>
                                                <h4 class='alert-heading h5'>
                                                    Import Error
                                                </h4>
                                                <p class='mb-0 text-break text-danger-emphasis'>
                                                    {{ imported.error }}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class='col-12'>
                        <div class='card bg-black bg-opacity-10 border border-light-subtle rounded overflow-hidden'>
                            <div class='card-header border-bottom border-light-subtle py-2 d-flex align-items-center gap-2 bg-white bg-opacity-10'>
                                <IconDatabaseImport :size='16' />
                                <small class='text-uppercase fw-bold'>Import Results</small>
                            </div>
                            <div class='card-body p-2 d-flex flex-column gap-2'>
                                <TablerNone
                                    v-if='!imported.results || !imported.results.length'
                                    label='No Results'
                                    :create='false'
                                />
                                <template v-else>
                                    <StandardItem
                                        v-for='res in imported.results'
                                        :key='res.id'
                                        :hover='true'
                                        @click='openResult(res)'
                                    >
                                        <div class='px-3 py-2'>
                                            <div class='d-flex align-items-center gap-2'>
                                                <IconMapPin
                                                    v-if='res.type === "Feature"'
                                                    :size='24'
                                                    stroke='1'
                                                    class='text-white-50'
                                                />
                                                <IconFile
                                                    v-else-if='res.type === "Asset"'
                                                    :size='24'
                                                    stroke='1'
                                                    class='text-white-50'
                                                />
                                                <IconPhoto
                                                    v-else-if='res.type === "Iconset"'
                                                    :size='24'
                                                    stroke='1'
                                                    class='text-white-50'
                                                />
                                                <IconMap2
                                                    v-else-if='res.type === "Basemap"'
                                                    :size='24'
                                                    stroke='1'
                                                    class='text-white-50'
                                                />
                                                <span
                                                    class='text-white text-break'
                                                    v-text='res.name'
                                                />
                                            </div>
                                        </div>
                                    </StandardItem>
                                </template>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { std, stdurl, server } from '../../../../src/std.ts';
import type { Import } from '../../../../src/types.ts';
import Status from '../../util/StatusDot.vue';
import timeDiff from '../../../timediff.ts';
import {
    TablerNone,
    TablerAlert,
    TablerDelete,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import {
    IconDownload,
    IconAlertTriangle,
    IconDatabaseImport,
    IconMapPin,
    IconFile,
    IconPhoto,
    IconMap2
} from '@tabler/icons-vue';

import MenuTemplate from '../util/MenuTemplate.vue';
import StandardItem from '../util/StandardItem.vue';

const route = useRoute();
const router = useRouter();

const error = ref<Error | undefined>()
const loading = ref({
    main: true,
    initial: true,
    run: true
});
const interval = ref<ReturnType<typeof setInterval>>();
const imported = ref<Import | undefined>();

onMounted(async () => {
    await fetch(true);

    interval.value = setInterval(async () => {
        await fetch()
    }, 2000);
});

onUnmounted(() => {
    if (interval.value) {
        clearInterval(interval.value);
    }
});

async function downloadImport() {
    const url = stdurl(`/api/import/${route.params.import}/raw`)
    url.searchParams.set('token', localStorage.token);
    url.searchParams.set('download', String(true));
    await std(url, {
        download: true
    })
}

async function deleteImport() {
    loading.value.initial = true;

    try {
        const { error: reqErr } = await server.DELETE('/api/import/{:import}', {
            params: {
                path: {
                    ':import': String(route.params.import)
                }
            }
        });
        if (reqErr) throw new Error(String(reqErr));

        router.push('/menu/imports');
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value.initial = false;
}

async function fetch(init = false) {
    if (init) loading.value.initial = true;

    try {
        const { data, error: reqErr } = await server.GET('/api/import/{:import}', {
             params: {
                path: {
                    ':import': String(route.params.import)
                }
            }
        });
        if (reqErr) throw new Error(String(reqErr));
        imported.value = data;

        if (imported.value && (imported.value.status === 'Fail' || imported.value.status === 'Success')) {
            if (interval.value) clearInterval(interval.value);
            loading.value.run = false;
        }
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value.initial = false;
}

function openResult(res: { type: string, type_id: string }) {
    if (res.type === 'Iconset') {
        router.push(`/menu/iconset/${res.type_id}`);
    } else if (res.type === 'Basemap') {
        router.push(`/menu/basemaps`);
    } else if (res.type === 'Asset') {
         router.push(`/menu/files`);
    } else if (res.type === 'Feature') {
        router.push(`/menu/features`);
    }
}
</script>
