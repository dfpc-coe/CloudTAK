<template>
    <MenuTemplate name='Overlay Explorer'>
        <div class='row g-0 py-2'>
            <div class='col-12 px-2'>
                <button
                    class='btn btn-primary w-100'
                    @click='$router.push("/menu/files")'
                >
                    <IconUser
                        :size='32'
                        :stroke='1'
                    />Your Files
                </button>
            </div>
        </div>

        <TablerLoading v-if='loading' />
        <template v-else>
            <TablerNone
                v-if='!list.total'
                label='Server Overlays'
                :create='false'
            />
            <template v-else>
                <div
                    v-for='ov in list.items'
                    :key='ov.id'
                    class='cursor-pointer col-12 py-2 px-3 hover-dark'
                >
                    <div class='col-12 py-2 px-2 d-flex align-items-center'>
                        <span
                            class='mx-2 cursor-pointer'
                            @click='createOverlay(ov)'
                            v-text='ov.name'
                        />
                    </div>
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconUser,
} from '@tabler/icons-vue'
import Overlay from '/src/stores/overlays/base.ts';
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();

export default {
    name: 'OverlayExplorer',
    components: {
        IconUser,
        TablerNone,
        TablerLoading,
        MenuTemplate
    },
    mounted: async function() {
        await this.fetchList();
    },
    watch: {
        paging: {
            deep: true,
            handler: async function() {
                await this.fetchList();
            },
        }
    },
    data: function() {
        return {
            loading: false,
            paging: {
                filter: '',
                limit: 30,
                page: 0
            },
            list: {
                total: 0,
                items: []
            }
        }
    },
    methods: {
        createOverlay: async function(overlay) {
            const url = stdurl(`/api/overlay/${overlay.id}/tiles`);

            this.loading = true;
            const res = await std(url);

            await mapStore.overlays.push(await Overlay.create(mapStore.map, {
                url,
                name: overlay.name,
                mode: 'overlay',
                mode_id: overlay.id,
                type: overlay.type,
                styles: overlay.styles
            }, {
                layers: overlay.styles
            }));

            this.loading = false;
            this.$emit('mode', 'overlays');

            this.$router.push('/menu/overlays');
        },
        fetchList: async function() {
            this.loading = true;
            const url = stdurl('/api/overlay');
            if (this.paging.filter) url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            this.list = await std(url);
            this.loading = false;
        }
    }
}
</script>
