<template>
    <div class='card card-sm'>
        <div class='card-body'>
            <div class='row align-items-center'>
                <div class='col-auto'>
                    <span
                        class='bg-primary text-white avatar cursor-pointer'
                        @click='$router.push("/layer")'
                    >
                        <IconBuildingBroadcastTower
                            :size='32' 
                            :stroke='1' 
                        />
                    </span>
                </div>
                <div class='col'>
                    <template v-if='loading'>
                        <TablerLoading :inline='true' />
                    </template>
                    <template v-else>
                        <a
                            class='font-weight-medium cursor-pointer'
                            @click='$router.push("/layer")'
                        >
                            <span v-text='list.total' /> Layers
                        </a>
                        <div class='text-muted'>
                            <span v-text='list.status.alarm' /> Alarming Layers
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { std } from '/src/std.ts';
import {
    IconBuildingBroadcastTower
} from '@tabler/icons-vue';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'CardLayers',
    components: {
        IconBuildingBroadcastTower,
        TablerLoading
    },
    data: function() {
        return {
            loading: true,
            list: {
                total: 0,
                status: {}
            }
        }
    },
    mounted: async function() {
        await this.fetch()
    },
    methods: {
        fetch: async function() {
            this.loading = true;
            this.list = await std('/api/layer?limit=1');
            this.loading = false;
        }
    }
}
</script>
