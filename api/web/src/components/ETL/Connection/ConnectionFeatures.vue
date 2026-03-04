<template>
    <div>
        <div class='card-header d-flex'>
            <h3 class='card-title'>
                Connection Features
            </h3>

            <div class='ms-auto btn-list'>
                <TablerDelete
                    v-if='!error && !loading && list.items.length'
                    v-tooltip='"Delete All Features"'
                    displaytype='icon'
                    @delete='deleteAll'
                />
                <TablerRefreshButton
                    title='Refresh'
                    :loading='loading'
                    @click='fetchList'
                />
            </div>
        </div>

        <div class='col-12 px-2 py-2'>
            <TablerInput
                v-model='paging.filter'
                icon='search'
                placeholder='Filter Callsign'
            />
        </div>

        <div
            v-if='!error && !loading && list.items.length'
            class='table-responsive'
        >
            <table class='table table-hover table-vcenter card-table'>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Callsign</th>
                        <th>Path</th>
                        <th>Properties</th>
                    </tr>
                </thead>
                <tbody>
                    <template
                        v-for='feature in list.items'
                        :key='feature.id'
                    >
                        <tr
                            class='cursor-pointer'
                            @click='selected = selected?.id === feature.id ? null : feature'
                        >
                            <td>
                                <div class='d-flex align-items-center'>
                                    <IconMapPin
                                        :size='32'
                                        stroke='1'
                                    />
                                    <span
                                        class='mx-2'
                                        v-text='feature.id'
                                    />
                                </div>
                            </td>
                            <td v-text='feature.properties?.callsign' />
                            <td v-text='feature.path' />
                            <td>
                                <span v-text='Object.keys(feature.properties || {}).length + " properties"' />
                            </td>
                            <td class='d-flex align-items-center'>
                                <div class='ms-auto btn-list'>
                                    <TablerDelete
                                        v-tooltip='"Delete Feature"'
                                        displaytype='icon'
                                        @delete='deleteFeature(feature)'
                                    />
                                </div>
                            </td>
                        </tr>
                        <tr v-if='selected?.id === feature.id'>
                            <td
                                colspan='5'
                                style='max-width: 0; overflow-x: auto;'
                            >
                                <CopyField
                                    mode='pre'
                                    :model-value='JSON.stringify(feature, null, 4)'
                                />
                            </td>
                        </tr>
                    </template>
                </tbody>
            </table>
        </div>
        <div
            v-else
            class='card-body'
        >
            <template v-if='error'>
                <TablerAlert
                    title='Feature Error'
                    :err='error'
                    :compact='true'
                />
            </template>
            <TablerLoading v-else-if='loading' />
            <TablerNone
                v-else-if='!list.items.length'
                :create='false'
                :compact='true'
            />
        </div>

        <div
            v-if='!error && !loading && list.items.length'
            class='card-footer'
        >
            <TablerPager
                :page='paging.page'
                :total='list.total'
                :limit='paging.limit'
                @page='paging.page = $event'
            />
        </div>
    </div>
</template>

<script setup lang='ts'>
import { useRoute } from 'vue-router';
import { ref, watch, onMounted } from 'vue';
import { std, stdurl } from '../../../std.ts';
import CopyField from '../../CloudTAK/util/CopyField.vue';
import {
    IconMapPin,
} from '@tabler/icons-vue'
import {
    TablerRefreshButton,
    TablerAlert,
    TablerNone,
    TablerDelete,
    TablerInput,
    TablerLoading,
    TablerPager,
} from '@tak-ps/vue-tabler';

const route = useRoute();
const error = ref<Error | undefined>(undefined);
const loading = ref(true);
const selected = ref<{
    id: number | string;
    path: string;
    type: string;
    properties: Record<string, unknown>;
    geometry: unknown;
} | null>(null);
const paging = ref({
    filter: '',
    limit: 20,
    page: 0
});

const list = ref<{
    total: number;
    items: Array<{
        id: number | string;
        path: string;
        type: string;
        properties: Record<string, unknown>;
        geometry: unknown;
    }>;
}>({
    total: 0,
    items: []
});

watch(paging.value, async () => {
    await fetchList();
});

onMounted(async () => {
    await fetchList();
});

async function fetchList() {
    loading.value = true;
    error.value = undefined;

    try {
        const url = stdurl(`/api/connection/${route.params.connectionid}/feature`);
        url.searchParams.set('limit', String(paging.value.limit));
        url.searchParams.set('page', String(paging.value.page));
        if (paging.value.filter) url.searchParams.set('filter', paging.value.filter);
        list.value = await std(url) as typeof list.value;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}

async function deleteAll() {
    loading.value = true;
    error.value = undefined;

    try {
        await std(`/api/connection/${route.params.connectionid}/feature`, {
            method: 'DELETE'
        });
        await fetchList();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}

async function deleteFeature(feature: { id: number | string }) {
    loading.value = true;
    error.value = undefined;

    try {
        await std(`/api/connection/${route.params.connectionid}/feature/${feature.id}`, {
            method: 'DELETE'
        });
        await fetchList();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}
</script>
