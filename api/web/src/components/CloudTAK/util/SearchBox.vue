<template>
    <div
        class='position-absolute text-white bg-dark rounded'
    >
        <TablerInput
            ref='searchBoxRef'
            v-model='query.filter'
            :autofocus='true'
            class='mt-0'
            placeholder='Place Search'
            icon='search'
        />

        <template v-for='item of results' >
            <Feature
                v-if='item instanceof COT'
                :deleteButton='false'
                :feature='item'
            />
            <div
                v-else
                class='col-12 px-2 py-2 hover-button cursor-pointer'
                @click='fetchSearch(item.text, item.magicKey)'
                v-text='item.text'
            />
        </template>
        <TablerLoading v-if='partialLoading' :compact='true'/>
    </div>
</template>

<script setup lang='ts'>
import type { SearchForward, SearchSuggest } from '../../../types.ts';
import Feature from './Feature.vue';
import { std, stdurl } from '../../../std.ts'
import { useMapStore } from '../../../stores/map.ts';
import { useCOTStore } from '../../../stores/cots.ts';
import COT from '../../../stores/base/cot.ts';
import {
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import { ref, watch } from 'vue';

const mapStore = useMapStore();
const cotStore = useCOTStore();

const emit = defineEmits(['close']);

const partialLoading = ref(false);

const query = ref<{
    filter: string,
}>({
    filter: '',
});

const results = ref<Array<COT | {
    text: string
    magicKey?: string
}>>([]);

watch(query.value, async () => {
    await fetchSearch();
});

async function fetchSearch(queryText?: string, magicKey?: string) {
    if (!magicKey || !queryText) {
        results.value.splice(0, results.value.length);

        results.value.push(...Array.from(cotStore
            .filter((cot) => {
                return cot.properties.callsign.toLowerCase().includes(query.value.filter.toLowerCase());
            }, { mission: true }))
            .slice(0, 5)
        )

        partialLoading.value = true;
        const url = stdurl('/api/search/suggest');
        url.searchParams.append('query', query.value.filter);
        results.value.push(...((await std(url)) as SearchSuggest).items)
        partialLoading.value = false;
    } else {
        const url = stdurl('/api/search/forward');
        url.searchParams.append('query', queryText);
        url.searchParams.append('magicKey', magicKey);
        const items = ((await std(url)) as SearchForward).items;

        query.value.filter = '';
        results.value = [];
        
        if (items.length) {
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

            emit('close');
        }
    }
}

</script>
