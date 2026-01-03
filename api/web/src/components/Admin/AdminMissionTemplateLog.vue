<template>
    <div>
        <div class='card-header'>
            <h1 class='card-title d-flex align-items-center'>
                <TablerIconButton
                    title='Back to Template'
                    @click='router.push(`/admin/template/${route.params.template}`)'
                >
                    <IconCircleArrowLeft
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <span
                    class='ms-2'
                    v-text='route.params.log === "new" ? "New Log" : log.name'
                />
            </h1>

            <div class='ms-auto btn-list'>
                <TablerDelete
                    v-if='route.params.log !== "new" && disabled'
                    displaytype='icon'
                    @delete='deleteLog'
                />
                <TablerIconButton
                    v-if='disabled'
                    title='Edit Log'
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
                desc='Loading Log'
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <template v-else-if='!disabled'>
                <div class='row g-2'>
                    <div class='col-12'>
                        <TablerInput
                            v-model='log.name'
                            label='Name'
                        />
                    </div>
                    <div class='col-12'>
                        <TablerInput
                            v-model='log.description'
                            label='Description'
                            :rows='3'
                        />
                    </div>
                    <div class='col-12'>
                        <UploadLogo
                            v-model='log.icon'
                            label='Log Icon'
                        />
                    </div>
                    <div class='col-12'>
                        <TablerSchemaBuilder
                            title='Log Schema'
                            v-model='log.schema'
                        />
                    </div>
                    <div class='col-12 d-flex'>
                        <div class='ms-auto'>
                            <button
                                class='btn btn-primary'
                                @click='saveLog'
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
                        v-if='log.icon'
                        class='me-4'
                    >
                        <img
                            :src='log.icon'
                            class='rounded border p-2 bg-white shadow-sm'
                            style='width: 128px; height: 128px; object-fit: contain;'
                        >
                    </div>
                    <div class='flex-fill'>
                        <div class='datagrid'>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>Name</div>
                                <div class='datagrid-content' v-text='log.name' />
                            </div>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>Description</div>
                                <div class='datagrid-content' v-text='log.description' />
                            </div>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>Created</div>
                                <div class='datagrid-content'>
                                    <TablerEpoch :date='log.created' />
                                </div>
                            </div>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>Updated</div>
                                <div class='datagrid-content'>
                                    <TablerEpoch :date='log.updated' />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class='mt-3'>
                    <div class='datagrid-title mb-2'>Schema Preview</div>
                    <div class='border border-secondary border-opacity-25 rounded'>
                        <TablerSchema
                            :schema='log.schema'
                            :model-value='{}'
                            :disabled='true'
                        />
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { v4 as randomUUID } from 'uuid';
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { std } from '../../../src/std.ts';
import {
    TablerInput,
    TablerAlert,
    TablerDelete,
    TablerIconButton,
    TablerLoading,
    TablerEpoch,
    TablerSchemaBuilder,
    TablerSchema
} from '@tak-ps/vue-tabler';
import {
    IconCircleArrowLeft,
    IconPencil,
} from '@tabler/icons-vue'
import UploadLogo from '../util/UploadLogo.vue';

interface MissionTemplateLog {
    id: string;
    template: string;
    name: string;
    description: string;
    icon?: string | null;
    created: string;
    updated: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: any;
}

const route = useRoute();
const router = useRouter();

const error = ref<Error | undefined>();
const disabled = ref(true);
const loading = ref(true);

const log = ref<MissionTemplateLog>({
    id: randomUUID(),
    template: String(route.params.template),
    name: '',
    description: '',
    icon: null,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    schema: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false
    }
});

onMounted(async () => {
    if (route.params.log !== "new") {
        await fetchLog();
    } else {
        disabled.value = false;
        loading.value = false;
    }
});

async function saveLog() {
    loading.value = true;

    try {
        if (route.params.log === "new") {
            log.value = await std(`/api/template/mission/${route.params.template}/log`, {
                method: 'POST',
                body: log.value
            }) as MissionTemplateLog;

            disabled.value = true;
            router.push(`/admin/template/${route.params.template}/log/${log.value.id}`);
        } else {
            log.value = await std(`/api/template/mission/${route.params.template}/log/${route.params.log}`, {
                method: 'PATCH',
                body: log.value
            }) as MissionTemplateLog;

            disabled.value = true;
        }
        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function deleteLog() {
    loading.value = true;

    try {
        await std(`/api/template/mission/${route.params.template}/log/${route.params.log}`, {
            method: 'DELETE'
        });

        router.push(`/admin/template/${route.params.template}`);
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function fetchLog() {
    loading.value = true;
    try {
        log.value = await std(`/api/template/mission/${route.params.template}/log/${route.params.log}`) as MissionTemplateLog;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
}
</script>
