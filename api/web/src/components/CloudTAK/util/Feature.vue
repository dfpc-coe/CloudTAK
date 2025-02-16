<template>
    <Contact
        v-if='feature.properties.group'
        class='px-2 py-2'
        :button-chat='false'
        :compact='compact'
        :contact='{
            "uid": feature.id,
            "callsign": feature.properties.callsign,
            "team": feature.properties.group.name,
            "notes": ""
        }'
    />
    <div
        v-else
        class='d-flex align-items-center px-3 py-2'
        :class='{
            "cursor-pointer": isZoomable,
            "cursor-default": !isZoomable,
            "hover-button": hover,
            "py-2": !compact
        }'
        @click='flyTo'
    >
        <span class='me-2'>
            <canvas
                v-if='feature.properties.icon'
                ref='imgCanvas'
                width='20'
                height='20'
            />
            <!-- Icons are in order of most preferred display => Least-->
            <IconVideo
                v-else-if='feature.properties && feature.properties.type === "b-m-p-s-p-loc"'
                :size='20'
                :color='feature.properties.stroke || "white"'
                stroke='1'
            />
            <IconLine
                v-else-if='feature.geometry && feature.geometry.type === "LineString"'
                :size='20'
                :color='feature.properties.stroke || "white"'
                stroke='1'
            />
            <IconCone
                v-else-if='feature.properties && feature.properties.sensor'
                :size='20'
                :color='feature.properties.stroke || "white"'
                stroke='1'
            />
            <IconPolygon
                v-else-if='feature.geometry && feature.geometry.type === "Polygon"'
                :size='20'
                :color='feature.properties.fill || "white"'
                stroke='1'
            />
            <IconMapPin
                v-else
                :size='20'
                stroke='1'
            />
        </span>
        <div
            class='text-truncate user-select-none'
            :style='
                deleteButton
                    ? "width: calc(100% - 60px);"
                    : "width: 100%;"
            '
            v-text='feature.properties.callsign || feature.properties.name || "Unnamed"'
        />

        <div
            v-if='deleteButton'
            class='ms-auto btn-list hover-button-hidden'
        >
            <TablerDelete
                v-if='deleteAction === "delete"'
                :size='20'
                displaytype='icon'
                @delete='deleteCOT'
            />
            <IconTrash
                v-else
                :size='20'
                class='cursor-pointer'
                stroke='1'
                @click='deleteCOT'
            />
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, useTemplateRef, watch } from 'vue';
import Contact from './Contact.vue';
import {
    TablerDelete
} from '@tak-ps/vue-tabler';
import {
    IconVideo,
    IconMapPin,
    IconTrash,
    IconLine,
    IconCone,
    IconPolygon,
} from '@tabler/icons-vue';
import { useMapWorkerStore } from '../../../stores/worker.ts';
const mapWorkerStore = useMapWorkerStore();
import { useCOTStore } from '../../../stores/cots.ts';
const cotStore = useCOTStore();
import { useMapStore } from '../../../stores/map.ts';
const mapStore = useMapStore();

const props = defineProps({
    feature: {
        type: Object,
        required: true
    },
    deleteButton: {
        type: Boolean,
        default: true
    },
    deleteAction: {
        type: String,
        default: 'delete' //emit or delete
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

const emit = defineEmits(['delete']);

const isZoomable = computed(() => {
    const cot = cotStore.get(props.feature.id, {
        mission: true
    })

    if (cot) return true;
    return false;
});

const canvas = useTemplateRef<HTMLCanvasElement>('imgCanvas');

watch(canvas, async () => {
    if (!canvas.value) return;

    const icon = mapStore.map.getImage(props.feature.properties.icon)

    if (!icon) return;

    const context = canvas.value.getContext('2d');

    canvas.value.height = 20;
    canvas.value.width = 20;

    if (!context) return;

    context.drawImage(
        await createImageBitmap(new ImageData(
            // @ts-expect-error icon.data.data issue
            new Uint8ClampedArray(icon.data.data, icon.data.width, icon.data.height),
            icon.data.width,
            icon.data.height,
        )),
        0, 0,
        icon.data.width,
        icon.data.height,
        0,0,
        20,20
    );
})

async function deleteCOT() {
    if (props.deleteAction === 'delete') {
        await mapWorkerStore.delete(props.feature.id);
    } else {
        emit('delete');
    }
}

async function flyTo() {
    if (!isZoomable.value) return;

    const cot = cotStore.get(props.feature.id, {
        mission: true
    });

    if (!cot) throw new Error('Could not find marker');

    cot.flyTo();
}
</script>
