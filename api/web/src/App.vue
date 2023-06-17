<template>
<div class='page'>
    <header class='navbar navbar-expand-md d-print-none' data-bs-theme="dark">
        <div class="container-xl">
            <div class="col-auto">
                <img @click='$router.push("/")' class='cursor-pointer' height='50' width='50' src='/logo.png'>
            </div>
            <div class="col mx-2">
                <div class="page-pretitle">TAK Public Safety</div>
                <h2 class="page-title">ETL Data Layers</h2>
            </div>

            <div v-if='user' class='ms-auto'>
                <div class='btn-list'>
                    <a href="/docs/" class="btn btn-dark" target="_blank" rel="noreferrer">
                        <CodeIcon/>Docs
                    </a>
                    <div class='dropdown'>
                        <div type="button" id="userProfileButton" data-bs-toggle="dropdown" aria-expanded="false" class='btn btn-dark'>
                            <UserIcon/>
                            </div>
                                <ul class="dropdown-menu" aria-labelledby='userProfileButton'>
                                    <div class='d-flex mx-2 cursor-pointer'>
                                        <UserIcon class='my-2'/><a @click='$router.push("/profile")' class="cursor-pointer dropdown-item">Profile</a>
                                    </div>
                                    <div class='d-flex mx-2 cursor-pointer'>
                                        <LogoutIcon class='my-2'/><a @click='logout' class="curdor-pointer dropdown-item">Logout</a>
                                    </div>
                                </ul>
                            </div>
                        <div>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <div v-if='user' class="navbar-expand-md">
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
                                    <BuildingBroadcastTowerIcon/>
                                </span>
                                <span class="nav-link-title">Layers</span>
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link cursor-pointer" @click='$router.push("/data")'>
                                <span class="nav-link-icon d-md-none d-lg-inline-block">
                                    <DatabaseIcon/>
                                </span>
                                <span class="nav-link-title">Data</span>
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link cursor-pointer" @click='$router.push("/basemap")'>
                                <span class="nav-link-icon d-md-none d-lg-inline-block">
                                    <MapIcon/>
                                </span>
                                <span class="nav-link-title">Basemaps</span>
                            </a>
                        </li>
                        <li class="nav-item dropdown">
                            <a id='util-dropdown' class="nav-link dropdown-toggle cursor-pointer" data-bs-toggle="dropdown" aria-expanded="false">
                                <span class="nav-link-icon d-md-none d-lg-inline-block">
                                    <ShovelIcon/>
                                </span>
                                <span class="nav-link-title">Utils</span>
                            </a>
                            <div class="dropdown-menu" aria-labelledby="util-dropdown">
                                <a @click='$router.push("/icon")' class="dropdown-item cursor-pointer">
                                    Icon Explorer
                                </a>
                            </div>
                        </li>
                    </ul>

                    <div class='ms-auto'>
                        <ul class="navbar-nav">
                            <li class="nav-item">
                                <a class="nav-link cursor-pointer" @click='$router.push("/admin")'>
                                    <span class="nav-link-icon d-md-none d-lg-inline-block">
                                        <AdjustmentsIcon/>
                                    </span>
                                    <span class="nav-link-title">Admin</span>
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <router-view/>

    <TablerError v-if='err' :err='err' @close='err = null'/>
</div>
</template>

<script>
import '@tabler/core/dist/js/tabler.min.js';
import '@tabler/core/dist/css/tabler.min.css';
import {
    CodeIcon,
    HomeIcon,
    LogoutIcon,
    UserIcon,
    MapIcon,
    NetworkIcon,
    DatabaseIcon,
    BuildingBroadcastTowerIcon,
    AdjustmentsIcon,
    ShovelIcon
} from 'vue-tabler-icons';
import {
    TablerError
} from '@tak-ps/vue-tabler';

export default {
    name: 'Tak-PS-ETL',
    data: function() {
        return {
            mounted: false,
            user: null,
            err: null,
            server: null,
        }
    },
    errorCaptured: function(err) {
        this.err = err;
    },
    watch: {
        async $route() {
            if (!this.mounted) return;
            if (localStorage.token) {
                await this.getLogin();
                if (!this.server) await this.getServer();
                return;
            }
            if (this.$route.name !== 'login') this.$router.push("/login");
        }
    },
    mounted: async function() {
        const url = window.stdurl('/api');

        if (localStorage.token) {
            await this.getLogin();
            await this.getServer();
        } else if (this.$route.name !== 'login') {
            this.$router.push("/login");
        }

        this.mounted = true;
    },
    methods: {
        logout: function() {
            this.user = null;
            delete localStorage.token;
            this.$router.push("/login");
        },
        getLogin: async function() {
            try {
                this.user = await window.std('/api/login');
            } catch (err) {
                this.user = null;
                delete localStorage.token;
                if (this.$route.name !== 'login') this.$router.push("/login");
            }
        },
        getServer: async function() {
            this.server = await window.std('/api/server');

            if (this.server.status === 'unconfigured') {
                this.$router.push("/admin");
            }
        }
    },
    components: {
        HomeIcon,
        CodeIcon,
        LogoutIcon,
        UserIcon,
        MapIcon,
        NetworkIcon,
        DatabaseIcon,
        TablerError,
        BuildingBroadcastTowerIcon,
        AdjustmentsIcon,
        ShovelIcon,
    }
}
</script>
