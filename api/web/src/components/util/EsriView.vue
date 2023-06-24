<template>
<div class='card-body'>
    <template v-if='err'>
        <Alert title='ESRI Connection Error' :err='err.message' :compact='true'/>
        <div class="col-md-12 mt-3">
            <div class='d-flex'>
                <div class='ms-auto'>
                    <a @click='$emit("close")' class="cursor-pointer btn btn-primary">Close Viewer</a>
                </div>
            </div>
        </div>
    </template>
    <template v-else-if='loading'>
        <TablerLoading desc='Connecting to ESRI Server'/>
    </template>
</div>
</template>

<script>
import {
    TablerLoading
} from '@tak-ps/vue-tabler';
import Alert from './Alert.vue';

export default {
    name: 'EsriProxy',
    props: {
        url: {
            type: URL
        },
        username: {
            type: String,
            required: true
        },
        password: {
            type: String,
            required: true
        },
    },
    data: function() {
        return {
            loading: true,
            err: null,
            token: null
        }
    },
    mounted: async function() {
        await this.generateToken();
    },
    methods: {
        generateToken: async function() {
            try {
                await window.std('/api/sink/esri', {
                    method: 'POST',
                    body: {
                        username: this.username,
                        password: this.password,
                        url: this.url
                    }
                });
            } catch (err) {
                this.err = err;
            }

            this.loading = false;
        }
    },
    components: {
        Alert,
        TablerLoading
    }
}
</script>
