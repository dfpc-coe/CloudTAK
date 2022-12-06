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


    <router-view/>
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

export default {
    name: 'Tak-PS-Stats',
    data: function() {
        return {
            ws: null,
            err: null,
        }
    },
    mounted: function() {
        const url = window.stdurl('/');
        url.protocol = 'ws:';

        console.error(url);

        this.ws = new WebSocket(url);
    },
    components: {
        HomeIcon,
        CodeIcon,
        NetworkIcon,
        DatabaseIcon
    }
}
</script>
