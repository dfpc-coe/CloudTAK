<template>
    <div
        v-if='!isDeleted'
        class='w-100'
    >
        <Contact
            v-if='feature.properties.group'
            class='px-2 py-2 w-100'
            :button-chat='false'
            :compact='compact'
            :contact='{
                "uid": feature.properties.id,
                "callsign": feature.properties.callsign,
                "team": feature.properties.group.name,
                "notes": ""
            }'
        />
        <StandardItem
            v-else
            class='w-100 d-flex flex-row gap-3 mb-2 align-items-center'
            :class='{
                "cursor-pointer": isZoomable && props.hover,
                "cursor-default": !isZoomable || props.hover === false,
                "hover": hover
            }'
            :hover='hover'
            @click.exact='flyToClick'
            @click.ctrl='selectClick'
        >
            <div
                v-if='props.gripHandle'
                :id='feature.id'
                class='d-flex drag-handle cursor-grab ms-2 align-items-center'
            >
                <IconGripVertical
                    :size='18'
                    stroke='1'
                />
            </div>

            <div
                class='icon-wrapper d-flex align-items-center justify-content-center rounded-circle'
                :class='{
                    "ms-2": !props.gripHandle
                }'
            >
                <FeatureIcon
                    :feature='feature'
                />
            </div>

            <div
                class='flex-grow-1 d-flex flex-column gap-1 py-2'
                style='min-width: 0;'
            >
                <div class='d-flex align-items-center gap-2'>
                    <span
                        class='fw-semibold text-truncate'
                        v-text='feature.properties.callsign || feature.properties.name || "Unnamed"'
                    />
                </div>
            </div>

            <div class='align-self-center me-2 btn-list hover-button-hidden'>
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
        </StandardItem>
    </div>
</template>

<script setup lang='ts'>
import { useRouter } from 'vue-router';
import { ref, onMounted } from 'vue';
import COT from '../../../base/cot.ts';
import FeatureIcon from './FeatureIcon.vue';
import Contact from './Contact.vue';
import StandardItem from './StandardItem.vue';
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

<style scoped>
.icon-wrapper {
    width: 3rem;
    height: 3rem;
    min-width: 3rem;
    min-height: 3rem;
    flex-shrink: 0;
}
</style>
