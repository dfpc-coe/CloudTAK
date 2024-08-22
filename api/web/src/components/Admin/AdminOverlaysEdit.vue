<template>
    <div>
        <div class='card-header'>
            <h1 class='card-title'>
                Edit Overlay
            </h1>
        </div>
        <div
            style='min-height: 20vh; margin-bottom: 61px'
            class='px-2'
        >
            <TablerLoading v-if='loading' />
            <div class='row'>
                <div class='col-12'>
                    <TablerInput
                        v-model='overlay.name'
                        label='Name'
                    />
                </div>
                <div class='col-12'>
                    <TablerInput
                        v-model='overlay.url'
                        label='Data URL'
                    />
                </div>
                <div class='col-12'>
                    <TablerEnum
                        v-model='overlay.type'
                        label='Type'
                        :options='["vector", "raster"]'
                    />
                </div>
                <div class='col-12'>
                    <TablerInput
                        v-model='overlay.styles'
                        label='GL Style'
                        placeholder='GL JS Style JSON'
                        :rows='6'
                    />
                </div>
                <div class='col-12 d-flex py-2'>
                    <div class='ms-auto'>
                        <button
                            class='btn btn-primary'
                            @click='saveOverlay'
                        >
                            Submit
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { std, stdurl, stdclick } from '/src/std.ts';

import {
    TablerEnum,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'OverlayAdmin',
    components: {
        TablerEnum,
        TablerInput,
        TablerLoading,
    },
    data: function() {
        return {
            loading: true,
            overlay: {
                name: '',
                url: '',
                type: 'vector',
                styles: ''
            }
        }
    },
    mounted: async function() {
        if (this.$route.params.overlay !== 'new') {
            await this.fetchOverlay();
        }
    },
    methods: {
        stdclick,
        saveOverlay: async function() {
            const overlay = JSON.parse(JSON.stringify(this.overlay));
            overlay.styles = JSON.parse(overlay.styles);

            this.loading = true;
            if (this.$route.params.overlay === 'new') {
                await std(`/api/overlay`, {
                    method: 'POST',
                    body: overlay
                });
            } else {
                await std(`/api/overlay/${this.overlay.id}`, {
                    method: 'PATCH',
                    body: overlay
                });
            }

            this.loading = false;
        },
        fetchOverlay: async function() {
            this.loading = true;
            const url = stdurl(`/api/overlay/${this.overlay.id}`);
            const overlay = await std(url);
            overlay.styles = JSON.parse(overlay.styles);
            this.overlay = overlay;

            this.loading = false;
        }
    }
}
</script>
