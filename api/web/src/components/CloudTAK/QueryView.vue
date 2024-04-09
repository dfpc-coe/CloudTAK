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
                <div class='modal-title'></div>
            </div>
        </div>
        <div class='col-12 overflow-auto' style='height: calc(100% - 106px)'>
            <TablerLoading v-if='loading' desc='Querying...'/>
            <template v-else>
                HERE
            </template>
        </div>
    </div>
</div>
</template>

<script>
import {
} from '@tabler/icons-vue';
import { std } from '/src/std.ts';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'CloudTAKQueryMode',
    props: {
        coords: {
            type: Array,
            required: true
        }
    },
    data: function() {
        return {
            loading: true,
            query: {}
        }
    },
    watch: {
        coords: {
            deep: true,
            handler: async function() {
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
        TablerLoading
    }
}
</script>
