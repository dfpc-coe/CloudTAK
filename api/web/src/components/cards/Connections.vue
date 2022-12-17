<template>
<div class="card card-sm">
    <div class="card-body">
        <div class="row align-items-center">
            <div class="col-auto">
                <span @click='$router.push("/connection")' class="bg-primary text-white avatar cursor-pointer">
                    <NetworkIcon/>
                </span>
            </div>
            <div class="col">
                <a @click='$router.push("/connection")' class="font-weight-medium cursor-pointer">
                    <span v-text='list.total'/> Connections
                </a>
                <div class="text-muted">
                    <span v-text='list.status.dead'/> dead connections
                </div>
            </div>
        </div>
    </div>
</div>
</template>

<script>
import {
    NetworkIcon
} from 'vue-tabler-icons';

export default {
    name: 'CardConnections',
    data: function() {
        return {
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
            this.list = await window.std('/api/connection?limit=1');
        }
    },
    components: {
        NetworkIcon
    }
}
</script>
