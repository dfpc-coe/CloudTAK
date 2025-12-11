<template>
    <div class='col-12 pb-2'>
        <div
            class='d-flex align-items-center cursor-pointer user-select-none py-2 px-2 rounded transition-all mx-2'
            :class='{ "bg-accent": expanded, "hover": !expanded }'
            @click='expanded = !expanded'
        >
            <IconUser
                :size='18'
                stroke='1'
                color='#6b7990'
                class='ms-2 me-1'
            />
            <label class='subheader cursor-pointer m-0'>Author</label>
            <div class='ms-auto d-flex align-items-center'>
                <span
                    v-if='props.creator.time'
                    class='cursor-pointer me-2 text-muted small'
                    @click.stop='relative = !relative'
                    v-text='relative ? timediff(props.creator.time) : props.creator.time'
                />
                <IconChevronDown
                    class='transition-transform'
                    :class='{ "rotate-180": !expanded }'
                    :size='18'
                />
            </div>
        </div>

        <div
            class='grid-transition'
            :class='{ expanded: expanded }'
        >
            <div class='overflow-hidden'>
                <div class='mx-2 pt-2'>
                    <ContactRow
                        :contact='contact || props.creator'
                        @chat='router.push(`/menu/chats/new?callsign=${$event.callsign}&uid=${$event.uid}`)'
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import timediff from '../../../timediff.ts';
import ContactRow from './Contact.vue';
import { useMapStore } from '../../../stores/map.ts';
import type { Contact, FeaturePropertyCreator } from '../../../types.ts';
import { useRouter } from 'vue-router';
import {
    IconUser,
    IconChevronDown
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

<style scoped>
.grid-transition {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.3s ease-out;
}

.grid-transition.expanded {
    grid-template-rows: 1fr;
}

.rotate-180 {
    transform: rotate(-90deg);
}

.transition-transform {
    transition: transform 0.3s ease-out;
}
</style>
