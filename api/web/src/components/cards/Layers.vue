<template>
<div class="card card-sm">
    <div class="card-body">
        <div class="row align-items-center">
            <div class="col-auto">
                <span @click='$router.push("/layer")' class="bg-primary text-white avatar cursor-pointer">
                    <IconBuildingBroadcastTower size='32'/>
                </span>
            </div>
            <div class="col">
                <template v-if='loading'>
                    <TablerLoading :inline='true'/>
                </template>
                <template v-else>
                    <a @click='$router.push("/layer")' class="font-weight-medium cursor-pointer">
                        <span v-text='list.total'/> Layers
                    </a>
                    <div class="text-muted">
                        <span v-text='list.status.alarm'/> Alarming Layers
                    </div>
                </template>
            </div>
        </div>
    </div>
</div>
</template>

<script>
import {
    IconBuildingBroadcastTower
} from '@tabler/icons-vue';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'CardLayers',
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
            this.list = await window.std('/api/layer?limit=1');
            this.loading = false;
        }
    },
    components: {
        IconBuildingBroadcastTower,
        TablerLoading
    }
}
</script>
