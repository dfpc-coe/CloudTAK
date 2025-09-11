<template>
    <div v-if='!isDeleted'>
        <Contact
            v-if='feature.properties.group'
            class='px-2 py-2'
            :button-chat='false'
            :compact='compact'
            :contact='{
                "uid": feature.properties.id,
                "callsign": feature.properties.callsign,
                "team": feature.properties.group.name,
                "notes": ""
            }'
        />
        <div
            v-else
            class='d-flex align-items-center px-3 py-2'
            :class='{
                "cursor-pointer": isZoomable && props.hover,
                "cursor-default": !isZoomable || props.hover === false,
                "hover-button": hover,
                "py-2": !compact
            }'
            @click.exact='flyToClick'
            @click.ctrl='selectClick'
        >
            <div
                v-if='props.gripHandle'
                :id='feature.id'
                class='d-flex me-2 drag-handle cursor-grab'
            >
                <IconGripVertical
                    :size='18'
                    stroke='1'
                />
            </div>

            <span class='me-2'>
                <FeatureIcon
                    :feature='feature'
                />
            </span>
            <div
                class='text-truncate user-select-none'
                :style='`width: ${textWidth};`'
                v-text='feature.properties.callsign || feature.properties.name || "Unnamed"'
            />

            <div class='ms-auto btn-list hover-button-hidden'>
                <TablerIconButton
                    v-if='infoButton'
                    title='View Info'
                    @click.stop.prevent='router.push(`/cot/${feature.id}`)'
                >
                    <IconListDetails
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>

                <TablerDelete
                    v-if='deleteButton && deleteAction === "delete"'
                    :size='20'
                    displaytype='icon'
                    @delete='deleteCOT'
                />
                <TablerIconButton
                    v-else-if='deleteButton'
                    title='Remove'
                    @click.stop.prevent='deleteCOT'
                >
                    <IconTrash
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { useRouter } from 'vue-router';
import { ref, onMounted, computed } from 'vue';
import COT from '../../../base/cot.ts';
import FeatureIcon from './FeatureIcon.vue';
import Contact from './Contact.vue';
import {
    TablerDelete,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconListDetails,
    IconGripVertical,
    IconTrash,
} from '@tabler/icons-vue';
import { useMapStore } from '../../../stores/map.ts';
const mapStore = useMapStore();

const props = defineProps({
    feature: {
        type: Object,
        required: true
    },
    select: {
        type: Boolean,
        default: false
    },
    deleteButton: {
        type: Boolean,
        default: true
    },
    deleteAction: {
        type: String,
        default: 'delete' //emit or delete
    },
    gripHandle: {
        type: Boolean,
        default: false
    },
    infoButton: {
        type: Boolean,
        default: false
    },
    hover: {
        type: Boolean,
        default: true
    },
    compact: {
        type: Boolean,
        default: true
    }
});

const router = useRouter();
const emit = defineEmits(['delete']);

const isDeleted = ref(false);
const isDeleting = ref(false);
const isZoomable = ref(false);

onMounted(async () => {
    const cot = await mapStore.worker.db.get(props.feature.id, {
        mission: true
    })

    isZoomable.value = cot ? true : false;
})

const textWidth = computed(() => {
    let width = `calc(100%`;

    if (props.deleteButton) width = width + '- 60px';
    if (props.infoButton) width = width + '- 60px';

    return width + ')'
});

async function deleteCOT() {
    if (props.deleteAction === 'delete') {
        isDeleting.value = true;

        await mapStore.worker.db.remove(props.feature.id);

        isDeleting.value = false;
        isDeleted.value = true;
    } else {
        emit('delete');
    }
}

async function selectClick() {
    if (!props.select && !(props.feature instanceof COT)) return;

    mapStore.selected.set(props.feature.id, props.feature as COT);
}

async function flyToClick() {
    if (!props.hover || !isZoomable.value || isDeleting.value || isDeleted.value) return;

    const cot = await mapStore.worker.db.get(props.feature.id, {
        mission: true
    });

    if (!cot) throw new Error('Could not find marker');

    cot.flyTo();
}
</script>
