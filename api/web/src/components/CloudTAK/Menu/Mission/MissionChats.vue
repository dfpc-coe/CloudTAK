<template>
    <MenuTemplate
        name='Mission Chats'
        :zindex='0'
        :back='false'
        :border='false'
    >
        <template #buttons>
            <TablerRefreshButton
                :loading='loading'
                @click='refresh'
            />
        </template>
        <template #default>
            <GenericChat
                :chats='chats || []'
                :my-u-i-d='myUID'
                :loading='loading'
                :error='error'
                :can-send='true'
                @send='onSend'
            />
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { from } from 'rxjs';
import { liveQuery } from 'dexie';
import type { Ref } from 'vue';
import { useObservable } from '@vueuse/rxjs';
import ProfileConfig from '../../../../base/profile.ts';
import MenuTemplate from '../../util/MenuTemplate.vue';
import GenericChat from '../../util/GenericChat.vue';
import Subscription from '../../../../base/subscription.ts';
import type { DBSubscriptionChat } from '../../../../base/database.ts';
import { TablerRefreshButton } from '@tak-ps/vue-tabler';
import { useMapStore } from '../../../../stores/map.ts';

const mapStore = useMapStore();

const props = defineProps<{
    subscription: Subscription
}>();

const loading = ref(false);
const error = ref<Error | undefined>(undefined);
const myUID = ref('');
const callsign = ref('');

const chats: Ref<Array<DBSubscriptionChat> | undefined> = useObservable(
    from(liveQuery(async () => {
        return await props.subscription.chat.list();
    }))
);

onMounted(async () => {
    const username = (await ProfileConfig.get('username'))?.value;
    const tak_callsign = (await ProfileConfig.get('tak_callsign'))?.value;
    myUID.value = username ? `ANDROID-CloudTAK-${username}` : '';
    callsign.value = String(tak_callsign || '');
    await props.subscription.chat.read();
});

async function onSend(message: string): Promise<void> {
    await props.subscription.chat.send(
        message,
        { uid: myUID.value, callsign: callsign.value },
        mapStore.worker
    );
}

async function refresh(): Promise<void> {
    loading.value = true;
    try {
        await props.subscription.feature.refresh();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
}
</script>
