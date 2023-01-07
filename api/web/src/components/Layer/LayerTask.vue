<template>
<div class='card'>
    <div class='card-header'>
        <h3 class='card-title'>Task Status</h3>
    </div>

    <div class='card-body'>
        <template v-if='loading'>
            <TablerLoading/>
        </template>
        <template v-else-if='status.status === "destroyed"'>
            <div class="d-flex justify-content-center mb-4">
                Stack Hasn't Deployed
            </div>
            <div class="d-flex justify-content-center mb-4">
                <div @click='postStack' class='btn btn-primary'>Deploy Stack</div>
            </div>
        </template>
    </div>
</div>
</template>

<script>
import {
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'LayerTask',
    data: function() {
        return {
            status: {}
        };
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        fetch: async function() {
            this.status = await window.std(`/api/layer/${this.$route.params.layerid}/task`);
        },
        postStack: async function() {
            await window.std(`/api/layer/${this.$route.params.layerid}/task`, {
                method: 'POST'
            });
        }
    },
    components: {
        TablerLoading
    }
}
</script>
