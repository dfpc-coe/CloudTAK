<template>
<div class='card-body'>
    <template v-if='err'>
        <Alert title='ESRI Connection Error' :err='err.message' :compact='true'/>
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
                await window.std('/api/proxy/esri', {
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
        }
    },
    components: {
        Alert,
        TablerLoading
    }
}
</script>
