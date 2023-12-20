<template>
<div class="card card-sm">
    <div class="card-body">
        <div class="row align-items-center">
            <div class="col-auto">
                <span @click='$router.push("/connection")' class="bg-primary text-white avatar cursor-pointer">
                    <IconNetwork/>
                </span>
            </div>
            <div class="col">
                <template v-if='loading'>
                    <TablerLoading :inline='true'/>
                </template>
                <template v-else>
                    <a @click='$router.push("/connection")' class="font-weight-medium cursor-pointer">
                        <span v-text='list.total'/> Connections
                    </a>
                    <div class="text-muted">
                        <span v-text='list.status.dead'/> dead connections
                    </div>
                </template>
            </div>
        </div>
    </div>
</div>
</template>

<script>
import {
    IconNetwork
} from '@tabler/icons-vue';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'CardConnections',
    data: function() {
        return {
            loading: true,
            list: {
                total: 0,
                status: {
                    live: 0,
                    dead: 0
                }
            }
        }
    },
    mounted: async function() {
        await this.fetch()
    },
    methods: {
        fetch: async function() {
            this.loading = true;
            this.list = await window.std('/api/connection?limit=1');
            this.loading = false;
        }
    },
    components: {
        IconNetwork,
        TablerLoading
    }
}
</script>
