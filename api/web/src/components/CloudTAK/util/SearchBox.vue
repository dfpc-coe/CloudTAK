<template>
    <div
        class='text-white bg-dark rounded'
    >
        <TablerInput
            ref='searchBoxRef'
            v-model='query.filter'
            :label='props.label'
            :autofocus='props.autofocus'
            class='mt-0'
            :placeholder='props.placeholder'
            icon='search'
            @focus='selected = false'
        />

        <div
            class='dropdown-menu w-100 mt-2'
            :class='{
                "show": shown,
            }'
        >
            <TablerNone
                v-if='!partialLoading && !cots.size && !results.length'
                :create='false'
            />
            <template v-else>
                <Feature
                    v-for='cot of cots'
                    :key='cot.id'
                    :delete-button='false'
                    :feature='cot'
                    @click='selectFeature(cot)'
                />
                <div
                    v-for='item of results'
                    :key='item.magicKey'
                    class='col-12 px-3 py-2 hover-button cursor-pointer user-select-none text-truncate'
                    @click='fetchSearch(item.text, item.magicKey)'
                >
                    <IconMapPin
                        :size='24'
                        stroke='1'
                    />

                    <span
                        class='ms-2'
                        v-text='item.text'
                    />
                </div>

                <TablerLoading
                    v-if='partialLoading'
                    :compact='true'
                />
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import type { SearchForward, SearchSuggest } from '../../../types.ts';
import { convert } from 'geo-coordinates-parser'
import { v4 as randomUUID } from 'uuid';
import Feature from './FeatureRow.vue';
import { std, stdurl } from '../../../std.ts'
import { useMapStore } from '../../../stores/map.ts';
import COT from '../../../base/cot.ts';
import {
    TablerNone,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconMapPin
} from '@tabler/icons-vue';
import { ref, watch, computed } from 'vue';

const props = defineProps({
    label: {
        type: String,
        default: ''
    },
    autofocus: {
        type: Boolean,
        default: false
    },
    placeholder: {
        type: String,
        default: 'Search...'
    }
});

const mapStore = useMapStore();

const emit = defineEmits(['select']);

const selected = ref(false);
const partialLoading = ref(false);

const shown = computed(() => {
    if (query.value.filter.length > 0 && !selected.value) {
        return true;
    } else {
        return false;
    }
});

const query = ref<{
    filter: string,
}>({
    filter: '',
});

const cots = ref<Set<COT>>(new Set())

const results = ref<Array<{
    text: string
    magicKey?: string
}>>([]);

watch(query.value, async () => {
    await fetchSearch();
});

async function selectFeature(cot: COT) {
    selected.value = true;

    query.value.filter = cot.properties.callsign;

    emit('select', {
        name: cot.properties.callsign,
        coordinates: cot.properties.center
    });
}

async function fetchSearch(
    queryText?: string,
    magicKey?: string
) {
    if (!queryText) {
        results.value = [];
    }

    if (!magicKey) {
        try {
            const c = convert(query.value.filter);

            results.value = [{
                text: `${c.decimalLatitude.toFixed(5)}, ${c.decimalLongitude.toFixed(5)}`,
                magicKey: 'coordinate'
            }]

            return;
        } catch (e) {
            if (e instanceof Error && !e.message.includes('coordinate')) {
                console.error('Error parsing coordinates:', e);
            }
        }
    }

    if (!magicKey || !queryText) {
        partialLoading.value = true;

        cots.value = await mapStore.worker.db
            .filter(`$contains($lowercase(properties.callsign), "${query.value.filter.toLowerCase()}")`, {
                mission: true,
                limit: 5
            })

        const url = stdurl('/api/search/suggest');
        url.searchParams.append('query', query.value.filter);
        url.searchParams.append('limit', '5');
        const center = mapStore.map.getCenter();
        url.searchParams.append('longitude', String(center.lng));
        url.searchParams.append('latitude', String(center.lat));

        results.value = [];
        results.value.push(...((await std(url)) as SearchSuggest).items)
        partialLoading.value = false;
   } else {
        selected.value = true;

        if (magicKey === 'coordinate') {
            const parts = queryText.split(',');
            const lat = parseFloat(parts[0].trim());
            const lon = parseFloat(parts[1].trim());

            mapStore.map.flyTo({
                center: [lon, lat],
                zoom: 15
            });

            // Create a draw point on the map
            const now = new Date().toISOString();
            const featureId = randomUUID();
            const feature = {
                id: featureId,
                type: 'Feature' as const,
                path: '/',
                properties: {
                    id: featureId,
                    callsign: 'Search Feature',
                    type: 'u-d-p',
                    how: 'h-g-i-g-o',
                    archived: true,
                    time: now,
                    start: now,
                    stale: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    center: [lon, lat],
                    "marker-opacity": 1,
                    "marker-color": "#FF0000",
                    creator: await mapStore.worker.profile.creator(),
                    remarks: 'Created from search result'
                },
                geometry: {
                    type: 'Point' as const,
                    coordinates: [lon, lat]
                }
            };

            await mapStore.worker.db.add(feature);

            emit('select', {
                name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
                coordinates: [ lon, lat ]
            });
        } else {
            const url = stdurl('/api/search/forward');
            url.searchParams.append('query', queryText);
            url.searchParams.append('magicKey', magicKey);
            const center = mapStore.map.getCenter();
            url.searchParams.append('longitude', String(center.lng));
            url.searchParams.append('latitude', String(center.lat));
            const items = ((await std(url)) as SearchForward).items;

            if (!items.length) return;

            results.value = [];

            query.value.filter = items[0].address;

            mapStore.map.fitBounds([
                [items[0].extent.xmin, items[0].extent.ymin],
                [items[0].extent.xmax, items[0].extent.ymax],
            ], {
                duration: 0,
                padding: {
                    top: 25,
                    bottom: 25,
                    left: 25,
                    right: 25
                }
            });

            // Create a draw point on the map
            const pointName = items[0].address.split(',')[0].trim();
            const now = new Date().toISOString();
            const featureId = randomUUID();
            const feature = {
                id: featureId,
                type: 'Feature' as const,
                path: '/',
                properties: {
                    id: featureId,
                    callsign: pointName,
                    type: 'u-d-p',
                    how: 'h-g-i-g-o',
                    archived: true,
                    time: now,
                    start: now,
                    stale: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    center: [items[0].location.x, items[0].location.y],
                    "marker-opacity": 1,
                    "marker-color": "#FF0000",
                    creator: await mapStore.worker.profile.creator(),
                    remarks: 'Created from search result'
                },
                geometry: {
                    type: 'Point' as const,
                    coordinates: [items[0].location.x, items[0].location.y]
                }
            };

            await mapStore.worker.db.add(feature);

            emit('select', {
                name: items[0].address,
                coordinates: [ items[0].location.x, items[0].location.y ]
            });
        }
    }
}

</script>
