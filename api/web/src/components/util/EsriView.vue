<template>
<div class='border py-2'>
    <h1 class='subheader px-3'>ESRI Server Explorer</h1>

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
    <template v-else-if='!server'>
        <div class='table-responsive'>
            <table class="table table-hover card-table table-vcenter cursor-pointer">
                <thead><tr><th>ID</th><th>Name</th><th>Url</th></tr></thead>
                <tbody><tr @click='server = serv' :key='serv.id' v-for='serv in servers'>
                    <td v-text='serv.id'></td>
                    <td v-text='serv.name'></td>
                    <td v-text='serv.url'></td>
                </tr></tbody>
            </table>
        </div>
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
            token: null,
            server: null,
            list: {},
            servers: []
        }
    },
    watch: {
        server: async function() {
            await this.getList()
        }
    },
    mounted: async function() {
        await this.generateToken();
    },
    methods: {
        getList: async function() {
            try {
                const url = window.stdurl('/api/sink/esri');
                url.searchParams.append('token', this.token);
                url.searchParams.append('url', this.server.url + '/rest');
                const res = await window.std(url, {
                    method: 'GET',
                });

                this.list = res;
            } catch (err) {
                this.err = err;
            }
            this.loading = false;
        },
        generateToken: async function() {
            try {
                const res = await window.std('/api/sink/esri', {
                    method: 'POST',
                    body: {
                        username: this.username,
                        password: this.password,
                        url: this.url
                    }
                });

                this.token = res.token;
                this.servers = res.servers;
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
