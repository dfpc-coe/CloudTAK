<template>
    <MenuTemplate
        name='Data Packages'
        :loading='loading'
    >
        <template #buttons>
            <IconPlus
                v-if='!loading'
                v-tooltip='"Create Package"'
                :size='32'
                :stroke='1'
                class='cursor-pointer'
                @click='upload = true'
            />

            <IconRefresh
                v-if='!loading'
                v-tooltip='"Refresh"'
                :size='32'
                :stroke='1'
                class='cursor-pointer'
                @click='fetchList'
            />
        </template>
        <template #default>
            <div v-if='upload' class='px-3 py-4'>
                <Upload
                    :url='uploadURL()'
                    :headers='uploadHeaders()'
                    @cancel='upload = false'
                    @done='fetchList'
                />
            </div>
            <template v-else>
                <ChannelInfo label='Data Packages' />
                <NoChannelsInfo v-if='hasNoChannels' />

                <TablerNone
                    v-if='!list.items.length'
                    label='Packages'
                    :create='false'
                />
                <template v-else>
                    <div
                        v-for='pkg in list.items'
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
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconRefresh,
} from '@tabler/icons-vue';
import timeDiff from '../../../timediff.js';
import ChannelInfo from '../util/ChannelInfo.vue';
import NoChannelsInfo from '../util/NoChannelsInfo.vue';
import Upload from '../../util/Upload.vue';
import { useProfileStore } from '/src/stores/profile.ts';
import { mapGetters } from 'pinia'

export default {
    name: 'CloudTAKPackages',
    components: {
        Upload,
        NoChannelsInfo,
        ChannelInfo,
        TablerNone,
        IconPlus,
        IconRefresh,
        MenuTemplate
    },
    data: function() {
        return {
            err: false,
            loading: true,
            upload: false,
            paging: {
            },
            list: []
        }
    },
    watch: {
        paging: {
            deep: true,
            handler: async function() {
                await this.fetchList()
            }
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    computed: {
        ...mapGetters(useProfileStore, ['hasNoChannels']),
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
            this.upload = false;
            this.loading = true;
            const url = stdurl('/api/marti/package');
            this.list = await std(url);
            this.loading = false;
        },
    }
}
</script>
