<template>
    <MenuTemplate :name='iconset.name'>
        <template #buttons>
            <TablerIconButton
                v-if='iconset.username || profile.system_admin'
                title='Create Icon'
                @click='editIconModal = {}'
            >
                <IconPlus
                    :size='32'
                    :stroke='1'
                />
            </TablerIconButton>

            <TablerIconButton
                v-if='iconset.username || profile.system_admin'
                title='Settings'
                @click='editIconsetModal = iconset'
            >
                <IconSettings
                    :size='32'
                    :stroke='1'
                />
            </TablerIconButton>

            <TablerIconButton
                title='Download TAK Zip'
                @click.stop='download'
            >
                <IconDownload
                    :size='32'
                    :stroke='1'
                />
            </TablerIconButton>

            <TablerDelete
                v-if='iconset.username || profile.system_admin'
                displaytype='icon'
                @delete='deleteIconset'
            />
        </template>
        <template #default>
            <TablerLoading v-if='loading' />
            <div
                v-else
                class='col-lg-12'
            >
                <CombinedIcons
                    v-if='!loading'
                    :iconset='iconset.uid'
                    :labels='false'
                />
            </div>
        </template>
    </MenuTemplate>

    <IconsetEditModal
        v-if='editIconsetModal'
        :icon='editIconsetModal'
        @close='refresh'
    />
    <IconEditModal
        v-if='editIconModal'
        :icon='editIconModal'
        @close='refresh'
    />
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import CombinedIcons from '../util/Icons.vue'
import {
    TablerDelete,
    TablerLoading,
    TablerIconButton,
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
import { useProfileStore } from '/src/stores/profile.ts';

export default {
    name: 'CloudTAKIconset',
    components: {
        IconPlus,
        IconSettings,
        IconDownload,
        IconEditModal,
        IconsetEditModal,
        MenuTemplate,
        CombinedIcons,
        TablerDelete,
        TablerLoading,
        TablerIconButton
    },
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
    computed: {
        ...mapState(useProfileStore, ['profile'])
    },
    mounted: async function() {
        await this.refresh();
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
}
</script>
