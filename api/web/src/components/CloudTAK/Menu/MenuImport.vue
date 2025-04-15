<template>
    <MenuTemplate name='Import'>
        <template #buttons>
            <TablerDelete
                v-if='imported && (imported.status === "Fail" || imported.status === "Success")'
                displaytype='icon'
                @delete='deleteImport'
            />
            <TablerRefreshButton
                :loading='loading.initial'
                @click='fetch(true)'
            />
        </template>
        <template #default>
            <TablerLoading v-if='!imported || loading.initial' />
            <TablerAlert
                v-else-if='error'
                title='Import Error'
                :err='error'
            />
            <div
                v-else
                class='mx-4 my-4'
            >
                <div class='datagrid'>
                    <div class='datagrid-item'>
                        <div class='datagrid-title'>
                            Import Name
                        </div>
                        <div class='datagrid-content d-flex align-items-center'>
                            <Status
                                :dark='true'
                                :status='imported.status'
                            /><span
                                class='mx-2'
                                v-text='imported.name'
                            />
                        </div>
                    </div>
                    <div class='datagrid-item'>
                        <div class='datagrid-title'>
                            Import Type
                        </div>
                        <div
                            class='datagrid-content'
                            v-text='imported.mode + ": " + imported.mode_id'
                        />
                    </div>
                </div>
                <div class='py-2'>
                    <TablerNone
                        v-if='imported.status === "Empty"'
                        :create='false'
                    />
                    <template v-else-if='loading.run'>
                        <TablerLoading
                            v-if='loading.run'
                            desc='Running Import'
                        />
                        <template v-if='batch && batch.logs.length'>
                            <label
                                for='logs'
                                class='subheader'
                            >Import Logs</label>
                            <pre
                                id='logs'
                                v-text='batch.logs.map((log) => { return log.message }).join("\n")'
                            />
                        </template>
                    </template>
                    <template v-else-if='imported.status === "Fail"'>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Import Error
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='imported.error'
                            />
                        </div>
                    </template>
                </div>
                <div class='datagrid d-flex'>
                    <div class='datagrid-item'>
                        <div class='datagrid-title'>
                            Created
                        </div>
                        <div
                            class='datagrid-content'
                            v-text='timeDiff(imported.created)'
                        />
                    </div>
                    <div class='datagrid-item ms-auto'>
                        <div class='datagrid-title'>
                            Updated
                        </div>
                        <div
                            class='datagrid-content'
                            v-text='timeDiff(imported.updated)'
                        />
                    </div>
                </div>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { std, stdurl } from '../../../../src/std.ts';
import type { Import, ImportBatch } from '../../../../src/types.ts';
import Status from '../../util/StatusDot.vue';
import timeDiff from '../../../timediff.ts';
import {
    TablerNone,
    TablerAlert,
    TablerDelete,
    TablerLoading,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';

const route = useRoute();
const router = useRouter();

const error = ref<Error | undefined>()
const loading = ref({
    main: true,
    initial: true,
    run: true
});
const interval = ref<ReturnType<typeof setInterval>>();
const batch = ref<ImportBatch | undefined>();
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

async function deleteImport() {
    loading.value.initial = true;

    try {
        const url = stdurl(`/api/import/${route.params.import}`);

        await std(url, {
            method: 'DELETE'
        });

        router.push('/menu/imports');
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value.initial = false;
}

async function fetch(init = false) {
    if (init) loading.value.initial = true;

    try {
        const url = stdurl(`/api/import/${route.params.import}`);
        imported.value = await std(url) as Import;

        if (imported.value && (imported.value.status === 'Fail' || imported.value.status === 'Success')) {
            if (interval.value) clearInterval(interval.value);
            loading.value.run = false;
        }

        if (imported.value.batch) {
            const urlBatch = stdurl(`/api/import/${route.params.import}/batch`);
            batch.value = await std(urlBatch) as ImportBatch;
        }
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value.initial = false;
}
</script>
