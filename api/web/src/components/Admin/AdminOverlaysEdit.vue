<template>
    <div>
        <div class='card-header'>
            <TablerIconButton
                title='Back'
                @click='$router.push("/admin/overlay")'
            >
                <IconCircleArrowLeft
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <h1 class='card-title'>
                <span class='mx-2'>Edit Overlay</span>
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
                    <label class='mx-2 my-1'>Ownership</label>
                    <div class='border rounded'>
                        <UserSelect
                            v-model='overlay.username'
                        />
                    </div>
                </div>
                <div class='col-12'>
                    <TablerInput
                        v-model='overlay.url'
                        label='Data URL'
                    >
                        <TablerToggle
                            label='Overlay'
                            v-model='overlay.overlay'
                        />
                    </TablerInput>
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
                        :advanced='true'
                    />
                </div>
                <div class='col-12 d-flex py-2'>
                    <TablerDelete
                        v-if='overlay.id'
                        @delete='deleteOverlay'
                    />
                    <div class='ms-auto'>
                        <TablerButton
                            class='btn-primary'
                            @click='saveOverlay'
                        >
                            Submit
                        </TablerButton>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { std, stdurl, stdclick } from '/src/std.ts';
import StyleContainer from '../Styling/Style.vue';
import UserSelect from '../util/UserSelect.vue';
import {
    IconCircleArrowLeft
} from '@tabler/icons-vue';
import {
    TablerEnum,
    TablerInput,
    TablerLoading,
    TablerToggle,
    TablerButton,
    TablerDelete,
    TablerIconButton
} from '@tak-ps/vue-tabler';

export default {
    name: 'OverlayAdmin',
    components: {
        UserSelect,
        TablerEnum,
        TablerDelete,
        TablerButton,
        TablerInput,
        TablerToggle,
        TablerLoading,
        StyleContainer,
        TablerIconButton,
        IconCircleArrowLeft,
    },
    data: function() {
        return {
            loading: true,
            overlay: {
                name: '',
                url: '',
                type: 'vector',
                overlay: true,
                styles: [],
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
        deleteOverlay: async function() {
            try {
                this.loading = true;

                await std(`/api/basemap/${this.overlay.id}`, {
                    method: 'DELETE'
                });

                this.$router.push('/admin/overlay');
            } catch (err) {
                this.loading = false;
                throw err;
            }
        },
        saveOverlay: async function() {
            let body = JSON.parse(JSON.stringify(this.overlay));

            body.bounds = body.bounds.split(',').map((b) => {
                return Number(b);
            })

            body.center = body.center.split(',').map((b) => {
                return Number(b);
            })

            if (body.username) {
                body.scope = 'user'
            } else {
                body.scope = 'server'
            }

            this.loading = true;

            try {
                if (this.$route.params.overlay === 'new') {
                    const url = stdurl(`/api/basemap`);
                    if (body.username) url.searchParams.append('impersonate', body.username);
                    const ov = await std(url, { method: 'POST', body });
                    ov.bounds = ov.bounds.join(',');
                    ov.center = ov.center.join(',');

                    this.overlay = ov;
                } else {
                    const url = stdurl(`/api/basemap/${this.overlay.id}`);
                    if (body.username) url.searchParams.append('impersonate', body.username);
                    const ov = await std(url, { method: 'PATCH', body });
                    ov.bounds = ov.bounds.join(',');
                    ov.center = ov.center.join(',');

                    this.overlay = ov;
                }

                this.loading = false;
            } catch (err) {
                this.loading = false;
                throw err;
            }
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
