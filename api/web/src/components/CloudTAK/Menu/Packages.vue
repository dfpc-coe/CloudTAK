<template>
<div>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$router.back()' size='32' class='cursor-pointer'/>
            <div class='modal-title'>Data Packages</div>
            <div class='btn-list'>
                <IconRefresh v-if='!loading' @click='fetchList' size='32' class='cursor-pointer' v-tooltip='"Refresh"'/>
            </div>
        </div>
    </div>
    <TablerLoading v-if='loading'/>
    <TablerNone v-else-if='!list.items.length' label='Imports' :create='false'/>
    <template v-else>
        <div :key='pkg.id' v-for='pkg in list.items'>
            <div class='col-12 py-2 px-3 align-items-center hover-dark'>
                <div class='col-12' v-text='pkg.Name'></div>
                <div class='col-12 subheader d-flex'>
                    <div v-text='timeDiff(pkg.SubmissionDateTime)'></div>
                    <div class='ms-auto' v-text='pkg.SubmissionUser'></div>
                </div>
            </div>
        </div>
    </template>
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconRefresh,
    IconCircleArrowLeft
} from '@tabler/icons-vue';
import timeDiff from '../../../timediff.js';

export default {
    name: 'CloudTAKPackages',
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
    },
    components: {
        TablerNone,
        TablerLoading,
        IconRefresh,
        IconCircleArrowLeft,
    }
}
</script>
