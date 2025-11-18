<template>
    <TablerModal
        v-if='mapStore.isMobileDetected'
        size='xl'
    >
        <div
            ref='menu'
            class='position-relative w-100 h-100 px-0'
        >
            <MainMenuContents
                :compact='false'
                :modal='true'
                @close='router.push("/")'
            />
        </div>
    </TablerModal>
    <template v-else>
        <div
            ref='container'
            class='position-absolute end-0 bottom-0 start-0'
            :class='{
                "start-0 end-0 top-0 bottom-0": resizing
            }'
        />
        <div
            class='position-absolute end-0 bottom-0 text-white d-flex'
            role='menubar'
            :class='{
                "bg-dark": !compact,
            }'
            style='z-index: 1; top: 56px;'
            :style='`
            width: ${compact ? "60px" : `${menuWidth}px`};
            min-width: ${compact ? "60px" : `400px`};
            ${compact ? "background-color: rgb(0, 0, 0, 0.5)" : ""}
        `'
        >
            <div
                v-if='!compact'
                ref='resize'
                class='resize hover cursor-drag'
            />
            <div
                ref='menu'
                class='position-relative w-100 h-100 px-0'
            >
                <MainMenuContents :compact='compact' />
            </div>
        </div>
    </template>
</template>

<script setup lang='ts'>
import { ref, watch, useTemplateRef, onMounted } from 'vue';
import {
    TablerModal,
} from '@tak-ps/vue-tabler';
import { useMapStore } from '../../stores/map.ts';
import { useRouter } from 'vue-router';
import MainMenuContents from './MainMenuContents.vue';

const router = useRouter();

const mapStore = useMapStore();

const resizing = ref(false);

const menu = useTemplateRef('menu');
const resize = useTemplateRef('resize');
const container = useTemplateRef('container');

const menuWidth = ref<number>(400);

const props = defineProps({
    compact: Boolean,
})

watch(props, () => {
    if (props.compact && mapStore.toastOffset.x !== 70) {
        mapStore.toastOffset.x = 70;
    } else if (!props.compact && mapStore.toastOffset.x !== menuWidth.value + 10) {
        mapStore.toastOffset.x = menuWidth.value + 10;
    }
});

watch(menuWidth, () => {
    mapStore.toastOffset.x = menuWidth.value + 10;
});

watch(resize, () => {
    if (resize.value && container.value && menu.value) {
        resizing.value = false;

        let beginWidth = menuWidth.value;
        let beginX = resize.value.getBoundingClientRect().x;
        let deltaX = 0;

        resize.value.addEventListener("mousedown", () => {
            if (!resize.value) return;
            beginWidth = menuWidth.value;
            beginX = resize.value.getBoundingClientRect().x;
            deltaX = 0;
            resizing.value = true;
        });

        menu.value.addEventListener("mousemove", (e) => {
            deltaX = beginX - e.x;

            if (resizing.value) {
                menuWidth.value = beginWidth + deltaX;
                e.preventDefault();
            }
        });

        container.value.addEventListener("mousemove", (e) => {
            deltaX = beginX - e.x;

            if (resizing.value) {
                menuWidth.value = beginWidth + deltaX;
                e.preventDefault();
            }
        });

        resize.value.addEventListener("mouseup", () => {
            resizing.value = false;
        });

        menu.value.addEventListener("mouseup", () => {
            resizing.value = false;
        });

        container.value.addEventListener("mouseup", () => {
            resizing.value = false;
        });
    }
})

onMounted(async () => {
    mapStore.toastOffset.x = props.compact ? 70 : menuWidth.value + 10;
})
</script>

<style scoped>
.resize {
   height: 100%;
   width: 14px;
   cursor: col-resize;
   flex-shrink: 0;
   position: relative;
   z-index: 10;
   user-select: none;
}
.resize::before {
   content: "";
   position: absolute;
   top: 50%;
   left: 50%;
   transform: translate(-50%, -50%);
   width: 3px;
   height: 15px;
   border-inline: 1px solid #fff;
}
</style>
