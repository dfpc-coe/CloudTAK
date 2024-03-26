<template>
<div>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$router.back()' size='32' class='cursor-pointer'/>
            <div class='modal-title' v-text='icon.name'></div>
            <div class='btn-list'>
                <TablerDelete v-if='iconset.username || profile.system_admin' displaytype='icon' @delete='deleteIcon'/>
                <IconSettings v-if='iconset.username || profile.system_admin' @click='$router.push(`/iconset/${$route.params.iconset}/icon/${encodeURIComponent($route.params.icon)}/edit`)' size='32' class='cursor-pointer'/>
            </div>
        </div>
    </div>
    <div class='mx-4'>
        <TablerLoading v-if='loading'/>
        <template v-else>
            <div class='pb-4'>
                <div class='d-flex justify-content-center mt-3'>
                    <img :src='iconurl(icon)' width='64'>
                </div>
            </div>
            <div class="datagrid">
                <div class='datagrid-item'>
                    <div class='datagrid-title'>Iconset</div>
                    <div class='datagrid-content' v-text='icon.iconset'></div>
                </div>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>Name</div>
                    <div class='datagrid-content' v-text='icon.name'></div>
                </div>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>Type 2525b</div>
                    <div class='datagrid-content' v-text='icon.type2525b || "None"'></div>
                </div>
            </div>
        </template>
    </div>
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerNone,
    TablerDelete,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconCircleArrowLeft,
    IconSettings,
    IconDownload
} from '@tabler/icons-vue';
import { mapState } from 'pinia';
import { useProfileStore } from '/src/stores/profile.js';

export default {
    name: 'Icon',
    data: function() {
        return {
            loading: true,
            iconset: {},
            icon: {
                id: false
            }
        }
    },
    mounted: async function() {
        this.loading = true;
        await this.fetchIconset();
        await this.fetch();
        this.loading = false;
    },
    computed: {
        ...mapState(useProfileStore, ['profile'])
    },
    methods: {
        iconurl: function() {
            const url = stdurl(`/api/iconset/${this.icon.iconset}/icon/${encodeURIComponent(this.icon.name)}/raw`);
            url.searchParams.append('token', localStorage.token);
            return String(url);
        },
        fetch: async function() {
            const url = stdurl(`/api/iconset/${this.$route.params.iconset}/icon/${encodeURIComponent(this.$route.params.icon)}`);
            this.icon = await std(url);
        },
        fetchIconset: async function() {
            const url = stdurl(`/api/iconset/${this.$route.params.iconset}`);
            this.iconset = await std(url);
        },
        deleteIcon: async function() {
            this.loading = true;
            const url = stdurl(`/api/iconset/${this.$route.params.iconset}/icon/${encodeURIComponent(this.$route.params.icon)}`);
            this.iconset = await std(url, {
                method: 'DELETE'
            });
            this.$router.push(`/iconset/${this.$route.params.iconset}`);
        }
    },
    components: {
        IconCircleArrowLeft,
        IconSettings,
        IconDownload,
        TablerDelete,
        TablerNone,
        TablerLoading
    }
}
</script>
