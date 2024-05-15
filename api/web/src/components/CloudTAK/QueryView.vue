<template>
<div
    class='position-absolute end-0 bottom-0 text-white bg-dark'
    style='z-index: 1; width: 400px; top: 56px;'
>
    <div class='position-relative h-100 container px-0'>
        <div class='sticky-top col-12 border-bottom border-light bg-dark'>
            <div class='modal-header px-0 mx-2 align-center'>
                <div class='modal-title'></div>
                <div class='modal-title'>Query Mode</div>
                <div class='btn-list'>
                    <IconRefresh @click='fetch' class='cursor-pointer' size='32'/>
                </div>
            </div>
        </div>
        <div class='col-12 overflow-auto' style='height: calc(100% - 106px)'>
            <Coordinate
                v-bind:modelValue='coords'
                class='py-2'
            />

            <TablerLoading v-if='loading' desc='Querying...'/>
            <template v-else>
                <QueryWeather
                    :weather='query.weather'
                    class='py-2'
                />
            </template>
        </div>
    </div>
</div>
</template>

<script>
import {
    IconRefresh
} from '@tabler/icons-vue';
import { std } from '/src/std.ts';
import QueryWeather from './Query/Weather.vue';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';
import Coordinate from './util/Coordinate.vue';

export default {
    name: 'CloudTAKQueryMode',
    data: function() {
        return {
            coords: this.$route.params.coords.split(','),
            loading: true,
            query: {}
        }
    },
    watch: {
        coords: {
            deep: true,
            handler: async function() {
                if (!this.coords) return;
                await this.fetch();
            }
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        fetch: async function() {
            this.loading = true;
            this.query = await std(`/api/search/reverse/${this.coords[0]}/${this.coords[1]}`);
            this.loading = false;
        }
    },
    components: {
        Coordinate,
        IconRefresh,
        QueryWeather,
        TablerLoading
    }
}
</script>
