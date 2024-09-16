<template>
    <TablerModal>
        <div class='modal-status bg-yellow' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='$emit("close")'
        />
        <div class='modal-header'>
            <div
                class='modal-title'
                v-text='pathid'
            />
        </div>

        <TablerLoading v-if='loading' />
        <div
            v-else
            class='modal-body row'
        >
            <pre v-text='path' />
        </div>
    </TablerModal>
</template>

<script>
import { std } from '/src/std.ts';
import {
    TablerModal,
    TablerLoading,
} from '@tak-ps/vue-tabler'

export default {
    name: 'VideoConfigPath',
    components: {
        TablerLoading,
        TablerModal
    },
    props: {
        pathid: {
            type: String,
            required: true
        }
    },
    emits: [
        'close',
        'refresh'
    ],
    data: function() {
        return {
            loading: true,
            path: false
        }
    },
    mounted: async function() {
        await this.fetchPath();
    },
    methods: {
        fetchPath: async function() {
            this.loading = true;
            this.path = await std(`/api/video/service/path/${this.pathid}`);
            this.loading = false;
        }
    }
}
</script>
