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
                    <a :href="docsURL" class="btn btn-dark" target="_blank" rel="noreferrer">
                        <IconCode size='32'/>Docs
                    </a>
                    <div class='dropdown'>
                        <div type="button" id="userProfileButton" data-bs-toggle="dropdown" aria-expanded="false" class='btn btn-dark'>
                            <IconUser size='32'/>
                            </div>
                                <ul class="dropdown-menu" aria-labelledby='userProfileButton'>
                                    <div @click='$router.push("/profile")' class='d-flex dropdown-item cursor-pointer hover-dark'>
                                        <IconUser size='32'/>
                                        <span class="mx-2">Profile</span>
                                    </div>
                                    <div @click='$router.push("/connection")' class='d-flex dropdown-item cursor-pointer hover-dark'>
                                        <IconNetwork size='32'/>
                                        <span class="mx-2">Connections</span>
                                    </div>
                                    <div @click='$router.push("/layer")' class='d-flex dropdown-item cursor-pointer hover-dark'>
                                        <IconBuildingBroadcastTower size='32'/>
                                        <span class="mx-2">Layers</span>
                                    </div>
                                    <div @click='$router.push("/iconset")' class='d-flex dropdown-item cursor-pointer hover-dark'>
                                        <IconPhoto size='32'/>
                                        <span class="mx-2">Iconsets</span>
                                    </div>
                                    <div @click='$router.push("/admin")' class='d-flex dropdown-item cursor-pointer hover-dark'>
                                        <IconSettings size='32'/>
                                        <span class='mx-2'>Server</span>
                                        <span class='ms-auto badge border border-red bg-red text-white'>Admin</span>
                                    </div>
                                    <div @click='logout' class='d-flex dropdown-item cursor-pointer hover-dark'>
                                        <IconLogout size='32'/>
                                        <span class="mx-2">Logout</span>
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
        @err='err = $event'
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
    IconUser,
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
import { std, stdurl } from '../std.js';

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
        const url = stdurl('/api');

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
    computed: {
        docsURL: function() {
            return stdurl('/docs')
        }
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
                this.user = await std('/api/login');
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
            this.server = await std('/api/server');

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
        IconUser,
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
