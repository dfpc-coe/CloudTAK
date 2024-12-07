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
                    @click='createOverlay(ov)'
                >
                    <div class='col-12 py-2 px-2 d-flex align-items-center'>
                        <span
                            class='mx-2'
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
import Overlay from '/src/stores/base/overlay.ts';
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
    watch: {
        paging: {
            deep: true,
            handler: async function() {
                await this.fetchList();
            },
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    methods: {
        createOverlay: async function(overlay) {
            this.loading = true;

            await mapStore.overlays.push(await Overlay.create(mapStore.map, {
                url: String(stdurl(`/api/basemap/${overlay.id}/tiles`)),
                name: overlay.name,
                mode: 'overlay',
                mode_id: overlay.id,
                type: overlay.type,
                styles: overlay.styles
            }));

            this.loading = false;
            this.$emit('mode', 'overlays');

            this.$router.push('/menu/overlays');
        },
        fetchList: async function() {
            this.loading = true;
            const url = stdurl('/api/basemap');
            if (this.paging.filter) url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('overlay', 'true');
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            this.list = await std(url);
            this.loading = false;
        }
    }
}
</script>
