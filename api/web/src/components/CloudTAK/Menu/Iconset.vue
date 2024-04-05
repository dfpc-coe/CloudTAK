<template>
<MenuTemplate :name='iconset.name'>
    <template #buttons>
        <IconPlus v-if='iconset.username || profile.system_admin' v-tooltip='"Create Icon"' @click='editIconModal = {}' size='32' class='cursor-pointer'/> <IconSettings v-if='iconset.username || profile.system_admin' @click='editIconsetModal = iconset' class='cursor-pointer' size='32'/>
        <IconDownload v-tooltip='"Download TAK Zip"' size='32' class='cursor-pointer' @click.stop='download'/>
        <TablerDelete v-if='iconset.username || profile.system_admin' displaytype='icon' @delete='deleteIconset'/>
    </template>
    <template #default>
        <TablerLoading v-if='loading'/>
        <div v-else class="col-lg-12">
            <CombinedIcons v-if='!loading' :iconset='iconset.uid' :labels='false'/>
        </div>
    </template>
</MenuTemplate>

<IconsetEditModal v-if='editIconsetModal' :icon='editIconsetModal' @close='refresh'/>
<IconEditModal v-if='editIconModal' :icon='editIconModal' @close='refresh'/>
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
} from '@tabler/icons-vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import IconEditModal from './Icon/EditModal.vue';
import IconsetEditModal from './Iconset/EditModal.vue';
import { mapState } from 'pinia';
import { useProfileStore } from '/src/stores/profile.js';

export default {
    name: 'CloudTAKIconset',
    data: function() {
        return {
            loading: true,
            editIconsetModal: false,
            editIconModal: false,
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
            this.editIconModal = false;
            this.editIconsetModal = false;
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
        IconEditModal,
        IconsetEditModal,
        MenuTemplate,
        CombinedIcons,
        TablerDelete,
        TablerLoading
    }
}
</script>
