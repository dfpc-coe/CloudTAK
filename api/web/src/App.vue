<template>
<div class='page'>
    <header class='navbar navbar-expand-md d-print-none' data-bs-theme="dark">
        <div class="container-xl">
            <div class="col-auto">
                <img @click='$router.push("/")' class='cursor-pointer' height='50' width='50' src='/logo.png'>
            </div>
            <div class="col mx-2">
                <div class="page-pretitle">Colorado - DFPC - CoE</div>
                <h2 class="page-title">CloudTAK</h2>
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
                                    <div class='d-flex mx-2 cursor-pointer hover-dark'>
                                        <IconNetwork class='my-2'/><a @click='$router.push("/connection")' class="cursor-pointer dropdown-item">Connections</a>
                                    </div>
                                    <div class='d-flex mx-2 cursor-pointer hover-dark'>
                                        <IconBuildingBroadcastTower class='my-2'/><a @click='$router.push("/layer")' class="cursor-pointer dropdown-item">Layers</a>
                                    </div>
                                    <div class='d-flex mx-2 cursor-pointer hover-dark'>
                                        <IconMap class='my-2'/><a @click='$router.push("/basemap")' class="cursor-pointer dropdown-item">Basemaps</a>
                                    </div>
                                    <div class='d-flex mx-2 cursor-pointer hover-dark'>
                                        <IconPhoto class='my-2'/><a @click='$router.push("/iconset")' class="cursor-pointer dropdown-item">Iconsets</a>
                                    </div>
                                    <div class='d-flex mx-2 cursor-pointer hover-dark'>
                                        <IconFileImport class='my-2'/><a @click='$router.push("/import")' class="cursor-pointer dropdown-item">Imports</a>
                                    </div>
                                    <div class='d-flex mx-2 cursor-pointer hover-dark'>
                                        <IconSettings class='my-2'/><a @click='$router.push("/admin")' class="cursor-pointer dropdown-item">Admin</a>
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

    <TablerLoading v-if='loading && !$route.path.includes("login")' desc='Loading CloudTAK'/>
    <router-view
        v-else
        @login='getLogin'
        :user='user'
    />

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
    IconFileImport,
    IconPhoto,
    IconNetwork,
    IconSettings,
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
        } else if (String(err) === 'Error: Authentication Required') {
            this.$router.push('/login');
        } else {
            this.err = err;
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

            await this.getServer()

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
        IconFileImport,
        TablerError,
        TablerModal,
        TablerLoading,
        IconBuildingBroadcastTower,
        IconAdjustments,
        IconPhoto,
    }
}
</script>
