<template>
<div>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$router.back()' size='32' class='cursor-pointer'/>
            <div class='modal-title'>Iconsets</div>
            <div class='btn-list'>
                <IconPlus v-if='iconset.username || profile.system_admin' v-tooltip='"Create Icon"' @click='editModal = {}' size='32' class='cursor-pointer'/>
                <IconSettings v-if='iconset.username || profile.system_admin' class='cursor-pointer' size='32'/>
                <IconDownload v-tooltip='"Download TAK Zip"' size='32' class='cursor-pointer' @click.stop='download'/>
                <TablerDelete v-if='iconset.username || profile.system_admin' displaytype='icon' @delete='deleteIconset'/>
            </div>
        </div>
    </div>

    <TablerLoading v-if='loading'/>
    <div v-else class="col-lg-12">
        <CombinedIcons v-if='!loading' :iconset='iconset.uid' :labels='false'/>
    </div>

    <IconEditModal v-if='editModal' :icon='editModal' @close='refresh'/>
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
    IconSettings,
    IconDownload,
    IconCircleArrowLeft
} from '@tabler/icons-vue';
import IconEditModal from './Icon/EditModal.vue';
import { mapState } from 'pinia';
import { useProfileStore } from '/src/stores/profile.js';

export default {
    name: 'CloudTAKIconset',
    data: function() {
        return {
            loading: true,
            editModal: false,
            iconset: {
                uid: ''
            }
        }
    },
    mounted: async function() {
        await this.refresh();
    },
    computed: {
        ...mapState(useProfileStore, ['profile'])
    },
    methods: {
        refresh: async function() {
            this.loading = true;
            this.editModal = false;
            await this.fetch();
            this.loading = false;
        },
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
            this.$router.push('/menu/iconset');
        }
    },
    components: {
        IconPlus,
        IconSettings,
        IconDownload,
        IconCircleArrowLeft,
        IconEditModal,
        CombinedIcons,
        TablerDelete,
        TablerLoading
    }
}
</script>
