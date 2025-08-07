<template>
    <MenuTemplate
        name='New Route'
        :loading='!mapStore.isLoaded'
    >
        <template #default>
            <TablerLoading
                v-if='loading'
                desc='Loading Features'
            />
            <template v-else>
                <div class='mx-2 my-2'>
                    <SearchBox
                        label='Start Location'
                        placeholder='Start Location'
                    />
                </div>
                <div class='mx-2 my-2'>
                    <SearchBox
                        label='End Location'
                        placeholder='End Location'
                    />
                </div>
                <div class='mx-2 my-3'>
                    <button
                        :disabled='!routePlan.start || !routePlan.end'
                        class='btn btn-primary w-100'
                    >Generate Route</button>
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import SearchBox from '../util/SearchBox.vue';
import COT from '../../../base/cot.ts';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerNone,
    TablerDelete,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import type { WorkerMessage } from '../../../base/events.ts';
import { WorkerMessageType } from '../../../base/events.ts';
import {
    IconPlus,
    IconRoute,
} from '@tabler/icons-vue';
import { useMapStore } from '../../../stores/map.ts';

const router = useRouter();
const mapStore = useMapStore();

const loading = ref(false);

const routePlan = ref<{
    start: null | [number, number];
    end: null | [number, number];
}>({
    start: null,
    end: null 
});

async function deleteRoute(id: string): Promise<void> {
    await mapStore.worker.db.remove(id);
    await refresh();
}

async function clickRoute(cot: COT): Promise<void> {
    cot.flyTo();

    router.push(`/cot/${cot.id}`);
}

</script>
