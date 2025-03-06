<template>
    <MenuTemplate
        name='API Tokens'
        :loading='loading'
        :none='!tokens.items.length'
    >
        <template #buttons>
            <IconPlus
                v-tooltip='"New Token"'
                :size='32'
                stroke='1'
                class='cursor-pointer'
                @click='token={}'
            />
            <IconRefresh
                v-tooltip='"Refresh"'
                :size='32'
                stroke='1'
                class='cursor-pointer'
                @click='fetch'
            />
        </template>
        <template #default>
            <div
                v-for='t in tokens.items'
                :key='t.id'
                class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'
                @click='token = t'
            >
                <IconRobot
                    :size='32'
                    stroke='1'
                />
                <span
                    class='mx-2'
                    style='font-size: 18px;'
                    v-text='t.name'
                />
            </div>
        </template>
    </MenuTemplate>

    <TokenModal
        v-if='token'
        :token='token'
        @close='token = false'
        @refresh='fetch'
    />
</template>

<script>
import MenuTemplate from '../util/MenuTemplate.vue';
import { std } from '/src/std.ts';
import TokenModal from './Settings/TokenModal.vue';
import {
    IconPlus,
    IconRefresh,
    IconRobot,
} from '@tabler/icons-vue';

export default {
    name: 'ProfileTokens',
    components: {
        MenuTemplate,
        TokenModal,
        IconPlus,
        IconRobot,
        IconRefresh,
    },
    data: function() {
        return {
            loading: true,
            token: false,
            tokens: {
                total: 0,
                items: []
            }
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        fetch: async function() {
            this.token = false;
            this.loading = true;
            this.tokens = await std('/api/token');
            this.loading = false;
        },
    }
}
</script>
