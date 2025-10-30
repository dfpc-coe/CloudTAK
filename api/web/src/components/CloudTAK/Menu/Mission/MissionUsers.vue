<template>
    <MenuTemplate
        name='Mission Subscribers'
        :zindex='0'
        :back='false'
        :border='false'
        :none='!subscriptions.length'
        :loading='loading'
    >
        <div
            v-for='sub of subscriptions'
        >
            <div class='col-12 py-2 px-2 d-flex hover'>
                <div class='col-12 d-flex align-items-center'>
                    <IconUserBolt
                        v-if='sub.role.type === "MISSION_OWNER"'
                        v-tooltip='sub.role.type'
                        :size='32'
                        stroke='1'
                    />
                    <IconUserEdit
                        v-else-if='sub.role.type === "MISSION_SUBSCRIBER"'
                        v-tooltip='sub.role.type'
                        :size='32'
                        stroke='1'
                    />
                    <IconUser
                        v-else-if='sub.role.type === "MISSION_READONLY_SUBSCRIBER"'
                        v-tooltip='sub.role.type'
                        :size='32'
                        stroke='1'
                    />
                    <div class='col-auto mx-2'>
                        <div v-text='sub.username' />
                        <div
                            class='subheader'
                            v-text='sub.username'
                        />
                    </div>
                    <div class='col-auto ms-auto btn-list' />
                </div>
            </div>
        </div>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import type { MissionSubscriptions } from '../../../../types.ts';
import Subscription from '../../../../base/subscription.ts';
import {
    IconUserBolt,
    IconUserEdit,
    IconUser
} from '@tabler/icons-vue';
import MenuTemplate from '../../util/MenuTemplate.vue';

const props = defineProps<{
    subscription: Subscription
}>();

const loading = ref(false);
const subscriptions = ref<MissionSubscriptions>([])

onMounted(async () => {
    await fetchSubscriptions();
});

async function fetchSubscriptions() {
    loading.value = true;
    subscriptions.value = await props.subscription.subscriptions();
    loading.value = false;
}
</script>
