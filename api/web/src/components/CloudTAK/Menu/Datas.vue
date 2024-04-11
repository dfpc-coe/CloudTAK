<template>
<MenuTemplate name='Overlay Explorer'>
    <div class='row g-0 py-2'>
        <div class='col-6 px-2'>
            <button @click='$router.push("/menu/datas/user")'class='btn btn-primary w-100'>
                <IconUser size='32'/>User Overlays
            </button>
        </div>
        <div class='col-6 px-2'>
            <button @click='$router.push("/menu/datas/sync")' class='btn btn-secondary w-100'>
                <IconDatabase size='32'/>DataSync Overlays
            </button>
        </div>
    </div>

    <TablerLoading v-if='loading'/>
    <template v-else>
        <TablerNone
            v-if='!overlays.total'
            label='Server Overlays'
            :create='false'
        />
        <template v-else>
            <div :key='a.id' v-for='a in overlays.items' class="cursor-pointer col-12 py-2 px-3 hover-dark">
                <div class='col-12 py-2 px-2 d-flex align-items-center'>
                    <span class="mx-2 cursor-pointer" v-text='a.name'></span>
                </div>
            </div>
        </template>
    </template>
</MenuTemplate>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerNone,
    TablerPager,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconDatabase,
    IconUser,
} from '@tabler/icons-vue'

export default {
    name: 'CloudTAKDatas',
    data: function() {
        return {
            loading: false,
            overlays: {
                total: 0,
                items: []
            }
        }
    },
    components: {
        IconUser,
        IconDatabase,
        TablerNone,
        TablerPager,
        TablerLoading,
        MenuTemplate
    }
}
</script>
