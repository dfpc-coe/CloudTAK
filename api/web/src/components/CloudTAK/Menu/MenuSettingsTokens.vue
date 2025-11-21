<template>
    <MenuTemplate
        name='API Tokens'
        :loading='loading'
        :none='!tokens.items.length'
    >
        <template #buttons>
            <TablerIconButton
                title='New Token'
                @click='token={}'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerRefreshButton
                :loading='loading'
                @click='fetch'
            />
        </template>
        <template #default>
            <div class='col-12 d-flex flex-column gap-2 p-3'>
                <MenuItemCard
                    v-for='t in tokens.items'
                    :key='t.id'
                    :icon='IconRobot'
                    :label='t.name'
                    @select='token = t'
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
import MenuItemCard from './MenuItemCard.vue';
import { std } from '../../../std.ts';
import TokenModal from './Settings/TokenModal.vue';
import {
    TablerIconButton,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconRobot,
} from '@tabler/icons-vue';

const loading = ref(true);
const token = ref(false);
const tokens = ref({
    total: 0,
    items: []
});

onMounted(async () => {
    await fetch();
});

async function fetch() {
    token.value = false;
    loading.value = true;
    tokens.value = await std('/api/profile/token');
    loading.value = false;
}
</script>
