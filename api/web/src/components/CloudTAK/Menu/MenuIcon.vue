<template>
    <MenuTemplate :name='icon.name'>
        <template #buttons>
            <TablerDelete
                v-if='iconset.username || profile.system_admin'
                displaytype='icon'
                @delete='deleteIcon'
            />
            <IconSettings
                v-if='iconset.username || profile.system_admin'
                :size='32'
                stroke='1'
                class='cursor-pointer'
                @click='editModal = icon'
            />
        </template>
        <template #default>
            <div class='mx-4'>
                <TablerLoading v-if='loading' />
                <template v-else>
                    <div class='pb-4'>
                        <div class='d-flex justify-content-center mt-3'>
                            <img
                                :src='iconurl(icon)'
                                width='64'
                            >
                        </div>
                    </div>
                    <div class='datagrid'>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Iconset
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='icon.iconset'
                            />
                        </div>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Name
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='icon.name'
                            />
                        </div>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Type 2525b
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='icon.type2525b || "None"'
                            />
                        </div>
                    </div>
                </template>
            </div>
        </template>
    </MenuTemplate>

    <IconEditModal
        v-if='editModal'
        :icon='editModal'
        @close='refresh'
    />
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerDelete,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconSettings,
} from '@tabler/icons-vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import IconEditModal from './Icon/EditModal.vue';
import { mapState } from 'pinia';
import { useProfileStore } from '/src/stores/profile.ts';

export default {
    name: 'CloudTAKIcon',
    data: function() {
        return {
            loading: true,
            editModal: false,
            iconset: {},
            icon: {
                id: false
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
            this.editModal = false;
            this.loading = true;
            await this.fetchIconset();
            await this.fetch();
            this.loading = false;
        },
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
        MenuTemplate,
        IconEditModal,
        IconSettings,
        TablerDelete,
        TablerLoading
    }
}
</script>
