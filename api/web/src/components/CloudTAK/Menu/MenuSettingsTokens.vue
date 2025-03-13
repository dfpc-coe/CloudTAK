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

<script setup>
import { ref, onMounted } from 'vue'
import MenuTemplate from '../util/MenuTemplate.vue';
import { std } from '../../std.ts';
import TokenModal from './Settings/TokenModal.vue';
import {
    IconPlus,
    IconRefresh,
    IconRobot,
} from '@tabler/icons-vue';

const loading = ref(true);
const token = ref(false);
const tokens = ref({
    total: 0,
    items: []
});

onMounted(async () => {
    await this.fetch();
});

async function fetch() {
    token.value = false;
    loading.value = true;
    tokens.value = await std('/api/token');
    loading.value = false;
}
</script>
