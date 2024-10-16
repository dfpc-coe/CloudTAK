<template>
    <MenuTemplate
        name='Data Packages'
        :loading='loading'
    >
        <template #buttons>
            <TablerIconButton
                v-if='!loading'
                title='Create Package'
                @click='upload = true'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerIconButton
                v-if='!loading'
                title='Refresh'
                @click='fetchList'
            >
                <IconRefresh
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
        </template>
        <template #default>
            <div
                v-if='upload'
                class='px-3 py-4'
            >
                <Upload
                    :url='uploadURL()'
                    :headers='uploadHeaders()'
                    @cancel='upload = false'
                    @done='fetchList'
                />
            </div>
            <template v-else>
                <div class='col-12 px-2 py-2'>
                    <TablerInput
                        v-model='paging.filter'
                        icon='search'
                        placeholder='Filter'
                    />
                </div>

                <ChannelInfo label='Data Packages' />
                <NoChannelsInfo v-if='hasNoChannels' />

                <TablerAlert
                    v-if='err'
                    title='Packages Error'
                    :err='err'
                />
                <TablerNone
                    v-else-if='!list.items.length'
                    label='Packages'
                    :create='false'
                />
                <template v-else>
                    <div
                        v-for='pkg in filteredList'
                        :key='pkg.Hash'
                    >
                        <div
                            class='col-12 py-2 px-3 align-items-center hover-dark cursor-pointer'
                            @click='$router.push(`/menu/packages/${pkg.Hash}`)'
                        >
                            <div
                                class='col-12'
                                v-text='pkg.Name'
                            />
                            <div class='col-12 subheader d-flex'>
                                <div v-text='timeDiff(pkg.SubmissionDateTime)' />
                                <div
                                    class='ms-auto'
                                    v-text='pkg.SubmissionUser'
                                />
                            </div>
                        </div>
                    </div>
                </template>
            </template>
        </template>
    </MenuTemplate>
</template>

<script>
import MenuTemplate from '../util/MenuTemplate.vue';
import { std, stdurl } from '/src/std.ts';

import {
    TablerNone,
    TablerAlert,
    TablerIconButton,
    TablerInput,
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconRefresh,
} from '@tabler/icons-vue';
import timeDiff from '../../../timediff.ts';
import ChannelInfo from '../util/ChannelInfo.vue';
import NoChannelsInfo from '../util/NoChannelsInfo.vue';
import Upload from '../../util/Upload.vue';
import { useProfileStore } from '/src/stores/profile.ts';
import { mapGetters } from 'pinia'

export default {
    name: 'CloudTAKPackages',
    components: {
        Upload,
        IconPlus,
        IconRefresh,
        NoChannelsInfo,
        ChannelInfo,
        TablerInput,
        TablerAlert,
        TablerIconButton,
        TablerNone,
        MenuTemplate
    },
    data: function() {
        return {
            err: false,
            loading: true,
            upload: false,
            paging: {
                filter: ''
            },
            list: {
                items: []
            }
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    computed: {
        ...mapGetters(useProfileStore, ['hasNoChannels']),
        filteredList: function() {
            return this.list.items.filter((pkg) => {
                return pkg.Name.toLowerCase()
                    .includes(this.paging.filter.toLowerCase());
            })
        }
    },
    methods: {
        uploadHeaders: function() {
            return {
                Authorization: `Bearer ${localStorage.token}`
            };
        },
        uploadURL: function() {
            return stdurl(`/api/marti/package`);
        },
        timeDiff(update) {
            return timeDiff(update)
        },
        fetchList: async function() {
            try {
                this.upload = false;
                this.loading = true;
                const url = stdurl('/api/marti/package');
                this.list = await std(url);
            } catch (err) {
                this.err = err;
            }

            this.loading = false;
        },
    }
}
</script>
