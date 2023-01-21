<template>
<div class='card'>
    <div class='card-header'>
        <h3 class='card-title'>Task Status</h3>
        <div class='ms-auto'>
            <RefreshIcon v-if='!loading.small' @click='fetch' width='24' height='24' class='cursor-pointer'/>
            <div v-else class='d-flex justify-content-center'>
                <div class="spinner-border" role="status"></div>
            </div>

        </div>
    </div>

    <div class='card-body'>
        <template v-if='loading.full'>
            <TablerLoading/>
        </template>
        <template v-else-if='error'>
            <div class="text-center py-4">
                <AlertCircleIcon height='48' width='48'/>
                <h3 class='pt-3'>AWS Cloudformation Error</h3>
                <div class="text-muted" v-text='error.message'></div>

                <div class="d-flex justify-content-center my-3">
                    <div @click='fetch' class='btn btn-secondary'>Refresh</div>
                </div>
            </div>
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
    RefreshIcon,
    AlertCircleIcon
} from 'vue-tabler-icons';

export default {
    name: 'LayerTask',
    data: function() {
        return {
            looping: false,
            error: false,
            loading: {
                full: true,
                small: true
            },
            stack: {}
        };
    },
    mounted: async function() {
        await this.fetch();

        this.looping = setInterval(() => {
            this.fetch(false);
        }, 10 * 1000);
    },
    unmounted: function() {
        if (this.looping) clearInterval(this.looping);
    },
    methods: {
        fetch: async function(showLoading=true) {
            if (showLoading) {
                this.loading.full = true;
            } else {
                this.loading.small = true;
            }

            this.error = false;

            try {
                this.stack = await window.std(`/api/layer/${this.$route.params.layerid}/task`);
            } catch (err) {
                this.error = err;
            }

            this.loading.full = false;
            this.loading.small = false;
        },
        postStack: async function() {
            this.loading.full = true;
            this.stack = await window.std(`/api/layer/${this.$route.params.layerid}/task`, {
                method: 'POST'
            });
            this.loading.full = false;
        }
    },
    components: {
        RefreshIcon,
        TablerLoading,
        AlertCircleIcon
    }
}
</script>
