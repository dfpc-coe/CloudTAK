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
                        <IconCode/>Docs
                    </a>
                    <div class='dropdown'>
                        <div type="button" id="userProfileButton" data-bs-toggle="dropdown" aria-expanded="false" class='btn btn-dark'>
                            <IconUser/>
                            </div>
                                <ul class="dropdown-menu" aria-labelledby='userProfileButton'>
                                    <div class='d-flex mx-2 cursor-pointer'>
                                        <IconUser class='my-2'/><a @click='$router.push("/profile")' class="cursor-pointer dropdown-item">Profile</a>
                                    </div>
                                    <div class='d-flex mx-2 cursor-pointer'>
                                        <IconLogout class='my-2'/><a @click='logout' class="curdor-pointer dropdown-item">Logout</a>
                                    </div>
                                </ul>
                            </div>
                        <div>
                    </div>
                    <div class='dropdown'>
                        <div type="button" id="userMenuButton" data-bs-toggle="dropdown" aria-expanded="false" class='btn btn-dark'>
                            <IconMenu/>
                            </div>
                                <ul class="dropdown-menu" aria-labelledby='userMenuButton'>
                                    <div class='d-flex mx-2 cursor-pointer'>
                                        <IconNetwork class='my-2'/><a @click='$router.push("/connection")' class="cursor-pointer dropdown-item hover-dark">Connections</a>
                                    </div>
                                    <div class='d-flex mx-2 cursor-pointer'>
                                        <IconBuildingBroadcastTower class='my-2'/><a @click='$router.push("/layer")' class="cursor-pointer dropdown-item hover-dark">Layers</a>
                                    </div>
                                    <div class='d-flex mx-2 cursor-pointer'>
                                        <IconDatabase class='my-2'/><a @click='$router.push("/data")' class="cursor-pointer dropdown-item hover-dark">Data</a>
                                    </div>
                                    <div class='d-flex mx-2 cursor-pointer'>
                                        <IconMap class='my-2'/><a @click='$router.push("/basemap")' class="cursor-pointer dropdown-item hover-dark">Basemaps</a>
                                    </div>
                                    <div class='d-flex mx-2 cursor-pointer'>
                                        <IconPhoto class='my-2'/><a @click='$router.push("/iconset")' class="cursor-pointer dropdown-item hover-dark">Iconsets</a>
                                    </div>
                                    <div class='d-flex mx-2 cursor-pointer'>
                                        <IconSettings class='my-2'/><a @click='$router.push("/admin")' class="cursor-pointer dropdown-item hover-dark">Admin</a>
                                    </div>
                                </ul>
                            </div>
                        <div>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <template v-if='upload'>
        <TablerModal>
            <UploadImport
                @close='upload = false'
            />
        </TablerModal>
    </template>

    <TablerLoading v-if='loading' desc='Loading CloudTAK'/>
    <router-view v-else :user='user'/>

    <TablerError v-if='err' :err='err' @close='err = null'/>
    <LoginModal v-if='login' @close='login = null' @login='login=null'/>
</div>
</template>

<style>
    .hover-light:hover {
        background: #f5f5f5;
    }

    .hover-dark:hover {
        background: #0f172a;
    }
</style>

<script>
import '@tabler/core/dist/js/tabler.min.js';
import '@tabler/core/dist/css/tabler.min.css';
import UploadImport from './components/util/UploadImport.vue'
import LoginModal from './components/util/LoginModal.vue'
import {
    IconCode,
    IconHome,
    IconLogout,
    IconMenu,
    IconUser,
    IconMap,
    IconPhoto,
    IconNetwork,
    IconSettings,
    IconDatabase,
    IconBuildingBroadcastTower,
    IconAdjustments,
} from '@tabler/icons-vue';
import {
    TablerModal,
    TablerLoading,
    TablerError
} from '@tak-ps/vue-tabler';

export default {
    name: 'Tak-PS-ETL',
    data: function() {
        return {
            loading: true,
            upload: false,
            dragTimer: false,
            login: false,
            mounted: false,
            user: null,
            err: null,
            server: null,
        }
    },
    errorCaptured: function(err) {
        if (err.message === '401') {
            this.login = true;
        } else {
            this.err = err;
        }
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

        addEventListener('dragover', (e) => {
            const dt = e.dataTransfer;
            if (dt.types && (dt.types.indexOf ? dt.types.indexOf('Files') != -1 : dt.types.contains('Files'))) {
                this.upload = true;
                window.clearTimeout(this.dragTimer);
            }
        });
    },
    methods: {
        logout: function() {
            this.user = null;
            delete localStorage.token;
            this.$router.push("/login");
        },
        getLogin: async function() {
            this.loading = true;
            try {
                this.user = await window.std('/api/login');
            } catch (err) {
                this.user = null;
                delete localStorage.token;
                if (this.$route.name !== 'login') this.$router.push("/login");
                this.loading = false;
            }
            this.loading = false;
        },
        getServer: async function() {
            this.server = await window.std('/api/server');

            if (this.server.status === 'unconfigured') {
                this.$router.push("/admin");
            }
        }
    },
    components: {
        LoginModal,
        UploadImport,
        IconHome,
        IconCode,
        IconSettings,
        IconLogout,
        IconMenu,
        IconUser,
        IconMap,
        IconNetwork,
        IconDatabase,
        TablerError,
        TablerModal,
        TablerLoading,
        IconBuildingBroadcastTower,
        IconAdjustments,
        IconPhoto,
    }
}
</script>
