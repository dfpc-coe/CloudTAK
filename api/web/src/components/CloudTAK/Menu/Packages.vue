<template>
    <MenuTemplate name='Data Packages'>
        <template #buttons>
            <IconRefresh
                v-if='!loading'
                v-tooltip='"Refresh"'
                size='32'
                class='cursor-pointer'
                @click='fetchList'
            />
        </template>
        <template #default>
            <TablerLoading v-if='loading' />
            <TablerNone
                v-else-if='!list.items.length'
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
    </MenuTemplate>
</template>

<script>
import MenuTemplate from '../util/MenuTemplate.vue';
import { std, stdurl } from '/src/std.ts';
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconRefresh,
} from '@tabler/icons-vue';
import timeDiff from '../../../timediff.js';

export default {
    name: 'CloudTAKPackages',
    components: {
        TablerNone,
        TablerLoading,
        IconRefresh,
        MenuTemplate
    },
    data: function() {
        return {
            err: false,
            loading: true,
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
    methods: {
        timeDiff(update) {
            return timeDiff(update)
        },
        fetchList: async function() {
            this.loading = true;
            const url = stdurl('/api/marti/package');
            this.list = await std(url);
            this.loading = false;
        },
    }
}
</script>
