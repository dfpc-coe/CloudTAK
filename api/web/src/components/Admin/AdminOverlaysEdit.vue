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
            <div
                v-else
                class='row'
            >
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
                <div class='col-12 col-md-6'>
                    <TablerInput
                        v-model='overlay.minzoom'
                        label='MinZoom'
                    />
                </div>
                <div class='col-12 col-md-6'>
                    <TablerInput
                        v-model='overlay.maxzoom'
                        label='MaxZoom'
                    />
                </div>
                <div class='col-12 col-md-6'>
                    <TablerInput
                        v-model='overlay.bounds'
                        label='Bounds'
                    />
                </div>
                <div class='col-12 col-md-6'>
                    <TablerInput
                        v-model='overlay.center'
                        label='Center'
                    />
                </div>
                <div class='col-12 col-md-6'>
                    <TablerEnum
                        v-model='overlay.type'
                        label='Type'
                        :options='["vector", "raster"]'
                    />
                </div>
                <div class='col-12 col-md-6'>
                    <TablerEnum
                        v-model='overlay.format'
                        label='Overlay Format'
                        :options='["png", "jpeg", "mvt"]'
                    />
                </div>
                <div class='col-12'>
                    <StyleContainer
                        v-model='overlay.styles'
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
import StyleContainer from '../Styling/Style.vue';
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
        StyleContainer,
    },
    data: function() {
        return {
            loading: true,
            overlay: {
                name: '',
                url: '',
                type: 'vector',
                overlay: true,
                styles: '',
                minzoom: 0,
                maxzoom: 16,
                bounds: '-180, -90, 180, 90',
                center: '0, 0',
            }
        }
    },
    mounted: async function() {
        if (this.$route.params.overlay !== 'new') {
            await this.fetchOverlay();
        } else {
            this.loading = false;
        }
    },
    methods: {
        stdclick,
        saveOverlay: async function() {
            let overlay = JSON.parse(JSON.stringify(this.overlay));

            overlay.bounds = overlay.bounds.split(',').map((b) => {
                return Number(b);
            })

            overlay.center = overlay.center.split(',').map((b) => {
                return Number(b);
            })

            this.loading = true;
            if (this.$route.params.overlay === 'new') {
                overlay = await std(`/api/basemap`, {
                    method: 'POST',
                    body: overlay
                });
            } else {
                overlay = await std(`/api/basemap/${this.overlay.id}`, {
                    method: 'PATCH',
                    body: overlay
                });
            }

            overlay.bounds = overlay.bounds.join(',');
            overlay.center = overlay.center.join(',');

            this.loading = false;
        },
        fetchOverlay: async function() {
            this.loading = true;
            const url = stdurl(`/api/basemap/${this.$route.params.overlay}`);
            const overlay = await std(url);

            if (!overlay.bounds) {
                overlay.bounds = '-180, -90, 180, 90';
            } else {
                overlay.bounds = overlay.bounds.join(',');
            }

            if (!overlay.center) {
                overlay.center = '0, 0';
            } else {
                overlay.center = overlay.center.join(',');
            }

            this.overlay = overlay
            this.loading = false;
        }
    }
}
</script>
