<template>
<div class='card'>
    <div class='card-header'>
            <h3 class='card-title'>Task Status</h3>
            <div class='ms-auto'>
                <RefreshIcon @click='fetch' class='cursor-pointer'/>
            </div>
    </div>

    <div class='card-body'>
        <template v-if='loading'>
            <TablerLoading/>
        </template>
        <template v-else-if='stack.status === "destroyed"'>
            <div class="d-flex justify-content-center mb-4">
                Stack Hasn't Deployed
            </div>
            <div class="d-flex justify-content-center mb-4">
                <div @click='postStack' class='btn btn-primary'>Deploy Stack</div>
            </div>
        </template>
        <template v-else>
            <pre v-text='stack.status'/>
        </template>
    </div>
</div>
</template>

<script>
import {
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    RefreshIcon
} from 'vue-tabler-icons';

export default {
    name: 'LayerTask',
    data: function() {
        return {
            loading: true,
            stack: {}
        };
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        fetch: async function() {
            this.loading = true;
            this.stack = await window.std(`/api/layer/${this.$route.params.layerid}/task`);
            this.loading = false;
        },
        postStack: async function() {
            this.loading = true;
            this.stack = await window.std(`/api/layer/${this.$route.params.layerid}/task`, {
                method: 'POST'
            });
            this.loading = false;
        }
    },
    components: {
        RefreshIcon,
        TablerLoading
    }
}
</script>
