<template>
    <div class='col-12'>
        <IconAmbulance
            :size='18'
            stroke='1'
            color='#6b7990'
            class='ms-2 me-1'
        />
        <label
            class='subheader user-select-none'
            v-text='"Data Sync"'
        />
        <div class='mx-2 pt-1 d-flex align-items-center'>
            <a
                class='cursor-pointer text-truncate'
                @click='router.push(`/menu/missions/${props.guid}`)'
                v-text='name'
            />
            <TablerIconButton
                v-if='props.edit'
                title='Remove Data Sync'
                class='ms-auto'
                @click='emit("update:guid", null)'
            >
                <IconTrash
                    :size='18'
                    stroke='1'
                />
            </TablerIconButton>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { TablerIconButton } from '@tak-ps/vue-tabler';
import { IconAmbulance, IconTrash } from '@tabler/icons-vue';
import Subscription from '../../../base/subscription.ts';

const props = defineProps<{
    /** GUID of the TAK Server Mission associated with the Event */
    guid: string;
    edit?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:guid', value: null): void
}>();

const router = useRouter();

// The Mission is only named locally if the user is subscribed to it
const name = ref(props.guid);

onMounted(async () => {
    await loadName();
});

watch(() => props.guid, async () => {
    await loadName();
});

async function loadName(): Promise<void> {
    name.value = props.guid;

    const subscription = await Subscription.from(props.guid);
    if (subscription) name.value = subscription.meta.name;
}
</script>
