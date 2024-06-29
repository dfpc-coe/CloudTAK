<template>
    <div>
        <div class='card-header'>
            <IconCircleArrowLeft
                class='cursor-pointer'
                :size='32'
                :stroke='1'
                @click='$router.push("/admin/user")'
            />

            <h1
                class='card-title mx-2'
                v-text='`User: ${$route.params.user}`'
            />

            <div class='ms-auto btn-list'>
                <IconRefresh
                    v-tooltip='"Refresh"'
                    :size='32'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='fetchUser'
                />
            </div>
        </div>
        <div class='card-body'>
            <TablerLoading v-if='loading' />
            <template v-else>
                <div class='datagrid'>
                    <template v-for='ele in Object.keys(user)'>
                        <div
                            v-if='user[ele]'
                            class='datagrid-item'
                        >
                            <div
                                class='datagrid-title'
                                v-text='ele'
                            />
                            <div
                                class='datagrid-content'
                                v-text='user[ele]'
                            />
                        </div>
                    </template>
                </div>
            </template>
        </div>
    </div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconRefresh,
    IconCircleArrowLeft,
} from '@tabler/icons-vue'

export default {
    name: 'UserAdmin',
    components: {
        IconRefresh,
        IconCircleArrowLeft,
        TablerLoading,
    },
    data: function() {
        return {
            loading: true,
            user: {}
        }
    },
    mounted: async function() {
        await this.fetchUser();
    },
    methods: {
        fetchUser: async function() {
            this.loading = true;
            const url = stdurl(`/api/user/${this.$route.params.user}`);
            this.user = await std(url);
            this.loading = false;
        }
    }
}
</script>
