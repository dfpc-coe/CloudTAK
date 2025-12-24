<template>
    <div class='col-12 pb-2'>
        <SlideDownHeader
            v-model='expanded'
            label='Author'
        >
            <template #icon>
                <IconUser
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
            </template>
            <template #right>
                <span
                    v-if='props.creator.time'
                    class='cursor-pointer me-2 text-muted small'
                    @click.stop='relative = !relative'
                    v-text='relative ? timediff(props.creator.time) : props.creator.time'
                />
            </template>
            <div class='mx-2 pt-2'>
                <ContactRow
                    :contact='contact || props.creator'
                    @chat='router.push(`/menu/chats/new?callsign=${$event.callsign}&uid=${$event.uid}`)'
                />
            </div>
        </SlideDownHeader>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import timediff from '../../../timediff.ts';
import ContactRow from './Contact.vue';
import { useMapStore } from '../../../stores/map.ts';
import type { Contact, FeaturePropertyCreator } from '../../../types.ts';
import { useRouter } from 'vue-router';
import SlideDownHeader from './SlideDownHeader.vue';
import {
    IconUser
} from '@tabler/icons-vue';

const mapStore = useMapStore();

const props = defineProps<{
    creator: FeaturePropertyCreator
}>();

const router = useRouter();
const relative = ref(true);
const expanded = ref(false);
const contact = ref<Contact | undefined>();

onMounted(async () => {
    contact.value = await mapStore.worker.team.get(props.creator.uid);
});
</script>


