<template>
<div class='page'>
    <header class='navbar navbar-expand-md navbar-dark d-print-none'>
        <div class="container-xl">
            <div class="col">
                <div class="page-pretitle">TAK Public Safety</div>
                <h2 class="page-title">ETL Data Layers</h2>
            </div>

            <div class='ms-auto'>
                <div class='btn-list'>
                    <a href="/docs/" class="btn btn-dark" target="_blank" rel="noreferrer">
                        <CodeIcon/>
                        Docs
                    </a>
                </div>
            </div>
        </div>
    </header>

    <div class="navbar-expand-md">
        <div class="collapse navbar-collapse" id="navbar-menu">
            <div class="navbar navbar-light">
                <div class="container-xl">
                    <ul class="navbar-nav">
                        <li class="nav-item">
                            <a class="nav-link cursor-pointer" @click='$router.push("/")'>
                                <span class="nav-link-icon d-md-none d-lg-inline-block">
                                    <HomeIcon/>
                                </span>
                                <span class="nav-link-title">Home</span>
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link cursor-pointer" @click='$router.push("/connection")'>
                                <span class="nav-link-icon d-md-none d-lg-inline-block">
                                    <NetworkIcon/>
                                </span>
                                <span class="nav-link-title">Connections</span>
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link cursor-pointer" @click='$router.push("/layer")'>
                                <span class="nav-link-icon d-md-none d-lg-inline-block">
                                    <DatabaseIcon/>
                                </span>
                                <span class="nav-link-title">Layers</span>
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </div>

    <template v-if='ws'>
        <router-view
            :ws='ws'
        />
    </template>

    <TablerError v-if='err' :err='err' @close='err = null'/>
</div>
</template>

<script>
import '@tabler/core/dist/js/tabler.min.js';
import '@tabler/core/dist/css/tabler.min.css';
import {
    CodeIcon,
    HomeIcon,
    NetworkIcon,
    DatabaseIcon
} from 'vue-tabler-icons';
import {
    TablerError
} from '@tak-ps/vue-tabler';

export default {
    name: 'Tak-PS-Stats',
    data: function() {
        return {
            user: null,
            ws: null,
            err: null,
        }
    },
    errorCaptured: function(err) {
        this.err = err;
    },
    mounted: function() {
        const url = window.stdurl('/');
        url.protocol = 'ws:';

        this.ws = new WebSocket(url);
        this.ws.addEventListener('error', (err) => {
            this.err = err;
        });

        if (localStorage.token) return await this.getLogin();
        if (this.$route.name !== 'login') this.$router.push("/login");
    },
    methods: {
        getLogin: async function() {
            try {
                this.user = await window.std('/api/login');
            } catch (err) {
                delete localStorage.token;
                this.$router.push("/login");
            }
        }
    },
    components: {
        HomeIcon,
        CodeIcon,
        NetworkIcon,
        DatabaseIcon,
        TablerError
    }
}
</script>
