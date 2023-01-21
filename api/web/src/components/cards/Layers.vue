<template>
<div class="card card-sm">
    <div class="card-body">
        <div class="row align-items-center">
            <div class="col-auto">
                <span @click='$router.push("/layer")' class="bg-primary text-white avatar cursor-pointer">
                    <DatabaseIcon/>
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
                        <span v-text='list.status.dead'/> Errored Layers
                    </div>
                </template>
            </div>
        </div>
    </div>
</div>
</template>

<script>
import {
    DatabaseIcon
} from 'vue-tabler-icons';
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
        DatabaseIcon,
        TablerLoading
    }
}
</script>
