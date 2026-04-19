<template>
    <div>
        <div class='card-header'>
            <TablerIconButton
                title='Back'
                @click='router.push("/admin/layer")'
            >
                <IconCircleArrowLeft
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <h1 class='mx-2 card-title'>
                Layer Update Management
            </h1>

            <div class='ms-auto btn-list'>
                <TablerRefreshButton
                    :loading='loading'
                    @click='fetchList'
                />
            </div>
        </div>

        <div style='min-height: 20vh; margin-bottom: 61px'>
            <TablerLoading
                v-if='loading'
                desc='Loading Layer Updates'
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <TablerNone
                v-else-if='!list.items.length'
                label='No Layers'
                :create='false'
            />
            <div
                v-else
                class='table-responsive pb-5'
            >
                <table class='table card-table table-hover table-vcenter datatable'>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Layer</th>
                            <th>Task</th>
                            <th>Current</th>
                            <th>Latest</th>
                            <th class='text-end'>
                                Action
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for='layer in list.items'
                            :key='layer.id'
                        >
                            <td v-text='layer.id' />
                            <td>
                                <div class='row'>
                                    <a
                                        href='#'
                                        class='text-decoration-none'
                                        @click.prevent='openLayer(layer)'
                                        v-text='layer.name'
                                    />
                                    <div class='d-flex flex-wrap align-items-center gap-2'>
                                        <span
                                            class='subheader'
                                            v-text='layer.parent_name || "Template Layer"'
                                        />
                                        <TablerBadge
                                            v-if='!layer.has_stack'
                                            background-color='rgba(245, 158, 11, 0.2)'
                                            border-color='rgba(245, 158, 11, 0.5)'
                                            text-color='#d97706'
                                        >
                                            Stack Missing
                                        </TablerBadge>
                                    </div>
                                </div>
                            </td>
                            <td v-text='layer.task_prefix' />
                            <td v-text='layer.current_version' />
                            <td>
                                <span v-text='layer.latest_version || "Unavailable"' />
                            </td>
                            <td class='text-end'>
                                <TablerButton
                                    :class='layer.has_stack ? "btn-primary btn-sm" : "btn-warning btn-sm"'
                                    :disabled='!canManageLayer(layer) || Boolean(updating[layer.id])'
                                    @click='manageLayer(layer)'
                                >
                                    <span v-if='updating[layer.id]'>Updating...</span>
                                    <span v-else-if='!layer.has_stack && layer.has_update'>Deploy Latest</span>
                                    <span v-else-if='!layer.has_stack'>Deploy</span>
                                    <span v-else-if='layer.has_update'>Update</span>
                                    <span v-else>Current</span>
                                </TablerButton>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { std } from '../../std.ts';
import type { AdminLayerUpdate, AdminLayerUpdateList } from '../../types.ts';
import {
    TablerAlert,
    TablerBadge,
    TablerButton,
    TablerIconButton,
    TablerLoading,
    TablerNone,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';
import {
    IconCircleArrowLeft,
} from '@tabler/icons-vue';

const router = useRouter();

const error = ref<Error | undefined>();
const loading = ref(true);
const updating = ref<Record<number, boolean>>({});
const list = ref<AdminLayerUpdateList>({
    total: 0,
    items: []
});

onMounted(async () => {
    await fetchList();
});

async function fetchList(): Promise<void> {
    loading.value = true;
    error.value = undefined;

    try {
        list.value = await std('/api/layer/update-management') as AdminLayerUpdateList;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
}

async function updateLayer(layer: AdminLayerUpdate): Promise<void> {
    updating.value[layer.id] = true;
    error.value = undefined;

    try {
        if (!layer.latest_version) {
            throw new Error('No newer version available');
        }

        await std(`/api/connection/${layer.connection ?? 'template'}/layer/${layer.id}`, {
            method: 'PATCH',
            body: {
                task: `${layer.task_prefix}-v${layer.latest_version}`
            }
        });

        await fetchList();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        delete updating.value[layer.id];
    }
}

async function redeployLayer(layer: AdminLayerUpdate): Promise<void> {
    updating.value[layer.id] = true;
    error.value = undefined;

    try {
        await std(`/api/connection/${layer.connection ?? 'template'}/layer/${layer.id}/redeploy`, {
            method: 'POST'
        });

        await fetchList();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        delete updating.value[layer.id];
    }
}

async function manageLayer(layer: AdminLayerUpdate): Promise<void> {
    if (!layer.has_stack && !layer.has_update) {
        await redeployLayer(layer);
        return;
    }

    await updateLayer(layer);
}

function canManageLayer(layer: AdminLayerUpdate): boolean {
    return !layer.has_stack || layer.has_update;
}

function openLayer(layer: AdminLayerUpdate): void {
    window.open(`/connection/${layer.connection ?? 'template'}/layer/${layer.id}`, '_blank');
}
</script>