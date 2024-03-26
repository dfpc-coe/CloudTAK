<template>
<div>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$router.back()' size='32' class='cursor-pointer'/>
            <div class='modal-title'>Iconsets</div>
            <div class='btn-list'>
                <IconPlus v-tooltip='"Create Icon"' @click='$router.push(`/iconset/${$route.params.iconset}/icon`)' size='32' class='cursor-pointer'/>
                <IconDownload v-tooltip='"Download TAK Zip"' size='32' class='cursor-pointer' @click.stop='download'/>
                <TablerDelete displaytype='icon' @delete='deleteIconset'/>
            </div>
        </div>
    </div>

    <TablerLoading v-if='loading'/>
    <div v-else class="col-lg-12">
        <CombinedIcons v-if='!loading' :iconset='iconset.uid' :labels='false'/>
    </div>
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import CombinedIcons from '../util/Icons.vue'
import {
    TablerDelete,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconDownload,
    IconCircleArrowLeft
} from '@tabler/icons-vue';

export default {
    name: 'Iconset',
    data: function() {
        return {
            loading: true,
            iconset: {
                uid: ''
            }
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        download: async function() {
            window.location.href = stdurl(`api/iconset/${this.iconset.uid}?format=zip&download=true&token=${localStorage.token}`);
        },
        fetch: async function() {
            this.loading = true;
            const url = stdurl(`/api/iconset/${this.$route.params.iconset}`);
            this.iconset = await std(url);
            this.loading = false;
        },
        deleteIconset: async function() {
            this.loading = true;
            const url = stdurl(`/api/iconset/${this.$route.params.iconset}`);
            this.iconset = await std(url, {
                method: 'DELETE'
            });
            this.$router.push('/iconset');
        }
    },
    components: {
        IconPlus,
        IconDownload,
        IconCircleArrowLeft,
        CombinedIcons,
        TablerDelete,
        TablerLoading
    }
}
</script>
