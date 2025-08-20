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
                        :autofocus='true'
                        @select='routePlan.start = $event ? $event.coordinates : null'
                    />
                </div>
                <div class='mx-2 my-2'>
                    <SearchBox
                        label='End Location'
                        placeholder='End Location'
                        :autofocus='false'
                        @select='routePlan.end = $event ? $event.coordinates : null'
                    />
                </div>
                <div class='mx-2 my-2'>
                    <label class='form-label'>Travel Mode</label>
                    <div class='px-2 py-2 round btn-group w-100' role='group'>
                        <input id='driving' v-model='routePlan.travelMode' value='1' type='radio' class='btn-check' autocomplete='off'>
                        <label for='driving' type='button' class='btn btn-sm'>Driving</label>
                        <input id='trucking' v-model='routePlan.travelMode' value='3' type='radio' class='btn-check' autocomplete='off'>
                        <label for='trucking' type='button' class='btn btn-sm'>Trucking</label>
                        <input id='rural' v-model='routePlan.travelMode' value='7' type='radio' class='btn-check' autocomplete='off'>
                        <label for='rural' type='button' class='btn btn-sm'>Rural</label>
                        <input id='walking' v-model='routePlan.travelMode' value='5' type='radio' class='btn-check' autocomplete='off'>
                        <label for='walking' type='button' class='btn btn-sm'>Walking</label>
                    </div>
                </div>                
                <div class='mx-2 my-3'>
                    <button
                        :disabled='!routePlan.start || !routePlan.end'
                        class='btn btn-primary w-100'
                        @click='generateRoute'
                    >
                        Generate Route
                    </button>
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import SearchBox from '../util/SearchBox.vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerLoading,
} from '@tak-ps/vue-tabler';
import { std, stdurl } from '../../../std.ts';
import { useMapStore } from '../../../stores/map.ts';
import type { FeatureCollection } from '../../../types.ts';

const router = useRouter();
const mapStore = useMapStore();

const loading = ref(false);

const routePlan = ref<{
    start: null | [number, number];
    end: null | [number, number];
    travelMode: string;
}>({
    start: null,
    end: null,
    travelMode: '1'
});

async function generateRoute(): Promise<void> {
    if (!routePlan.value.start || !routePlan.value.end) {
        return;
    }

    loading.value = true;

    try {
        const url = stdurl('/api/search/route');
        url.searchParams.set('start', routePlan.value.start.join(','));
        url.searchParams.set('end', routePlan.value.end.join(','));
        url.searchParams.set('travelMode', routePlan.value.travelMode);

        const route = await std(url) as FeatureCollection;

        if (route.features.length > 0) {
            const cot = await mapStore.worker.db.add(route.features[0]);

            cot.flyTo();

            router.push(`/cot/${cot.id}`);
        } else {
            throw new Error('No Route Found');
        }

        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

</script>
