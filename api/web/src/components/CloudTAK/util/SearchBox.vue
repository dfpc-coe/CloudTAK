<template>
    <div
        class='position-absolute text-white bg-dark rounded'
    >
        <TablerInput
            v-model='searchBox.query.filter'
            class='mt-0'
            placeholder='Place Search'
            icon='search'
        />

        <div
            v-for='item of searchBox.results'
            :key='item.magicKey'
            class='col-12 px-2 py-2 hover-button cursor-pointer'
            @click='fetchSearch(item.text, item.magicKey)'
            v-text='item.text'
        />
    </div>
</template>

<script setup lang='ts'>
import type { SearchForward, SearchSuggest } from '../../../types.ts';
import { std, stdurl } from '../../../std.ts'
import { useMapStore } from '../../../stores/map.ts';
import {
    TablerInput
} from '@tak-ps/vue-tabler';
import { ref, watch } from 'vue';

const searchBox = ref<{
    query: {
        filter: string,
    },
    results: Array<{
        text: string
        magicKey: string
    }>
}>({
    query: {
        filter: '',
    },
    results: []
});

watch(searchBox.value.query, async () => {
    await fetchSearch();
});

async function fetchSearch(query?: string, magicKey?: string) {
    if (!magicKey || !query) {
        const url = stdurl('/api/search/suggest');
        url.searchParams.append('query', searchBox.value.query.filter);
        searchBox.value.results = ((await std(url)) as SearchSuggest).items;
    } else {
        const url = stdurl('/api/search/forward');
        url.searchParams.append('query', query);
        url.searchParams.append('magicKey', magicKey);
        const items = ((await std(url)) as SearchForward).items;

        searchBox.value.shown = false;
        searchBox.value.query.filter = '';
        searchBox.value.results = [];

        if (items.length) {
            const mapStore = useMapStore();

            mapStore.map.fitBounds([
                [items[0].extent.xmin, items[0].extent.ymin],
                [items[0].extent.xmax, items[0].extent.ymax],
            ], {
                duration: 0,
                padding: {top: 25, bottom:25, left: 25, right: 25}
            });
        }
    }
}

</script>
