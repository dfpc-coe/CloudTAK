<template>
    <svg
        id='icons'
        ref='icons'
        class='d-none'
    >
        <symbol
            id='radial-lock'
            viewBox='0 0 24 24'
            fill='none'
            width='24'
            height='24'
            stroke='#fff'
            stroke-width='2'
            stroke-linejoin='round'
            stroke-linecap='round'
        >
            <path d='M12.5 21h-5.5a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2h10c.24 0 .47 .042 .683 .12' />
            <path d='M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0' />
            <path d='M8 11v-4a4 4 0 1 1 8 0v4' />
            <path d='M21.121 20.121a3 3 0 1 0 -4.242 0c.418 .419 1.125 1.045 2.121 1.879c1.051 -.89 1.759 -1.516 2.121 -1.879z' />
            <path d='M19 18v.01' />
        </symbol>
        <symbol
            id='radial-question'
            viewBox='0 0 24 24'
            stroke-width='2'
            stroke='#fff'
            fill='none'
            stroke-linecap='round'
            stroke-linejoin='round'
        ><path
            stroke='none'
            d='M0 0h24v24H0z'
            fill='none'
        /><path d='M8 8a3.5 3 0 0 1 3.5 -3h1a3.5 3 0 0 1 3.5 3a3 3 0 0 1 -2 3a3 4 0 0 0 -2 4' /><path d='M12 19l0 .01' /></symbol>
        <symbol
            id='radial-play'
            viewBox='0 0 24 24'
            stroke-width='2'
            stroke='#fff'
            fill='none'
            stroke-linecap='round'
            stroke-linejoin='round'
        ><path
            stroke='none'
            d='M0 0h24v24H0z'
            fill='none'
        /><path d='M7 4v16l13 -8z' /></symbol>
        <symbol
            id='radial-trash'
            viewBox='0 0 24 24'
            stroke-width='2'
            stroke='#fff'
            fill='none'
            stroke-linecap='round'
            stroke-linejoin='round'
        ><path
            stroke='none'
            d='M0 0h24v24H0z'
            fill='none'
        /><path d='M4 7l16 0' /><path d='M10 11l0 6' /><path d='M14 11l0 6' /><path d='M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12' /><path d='M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3' /></symbol>
        <symbol
            id='radial-view'
            viewBox='0 0 24 24'
            stroke-width='2'
            stroke='#fff'
            fill='none'
            stroke-linecap='round'
            stroke-linejoin='round'
        ><path
            stroke='none'
            d='M0 0h24v24H0z'
            fill='none'
        /><path d='M13 5h8' /><path d='M13 9h5' /><path d='M13 15h8' /><path d='M13 19h5' /><path d='M3 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z' /><path d='M3 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z' /></symbol>
        <symbol
            id='radial-pencil'
            viewBox='0 0 24 24'
            stroke-width='2'
            stroke='#fff'
            fill='none'
            stroke-linecap='round'
            stroke-linejoin='round'
        ><path
            stroke='none'
            d='M0 0h24v24H0z'
            fill='none'
        /><path d='M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4' /><path d='M13.5 6.5l4 4' /></symbol>
        <symbol
            id='radial-pencil-plus'
            viewBox='0 0 24 24'
            stroke-width='2'
            stroke='#fff'
            fill='none'
            stroke-linecap='round'
            stroke-linejoin='round'
        ><path
            stroke='none'
            d='M0 0h24v24H0z'
            fill='none'
        /><path d='M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4' /><path d='M13.5 6.5l4 4' /><path d='M16 19h6' /><path d='M19 16v6' /></symbol>
        <symbol
            id='radial-save'
            viewBox='0 0 24 24'
            fill='none'
            stroke='#fff'
            stroke-width='2'
            stroke-linecap='round'
            stroke-linejoin='round'
        >
            <path d='M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2' />
            <path d='M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' />
            <path d='M14 4l0 4l-6 0l0 -4' />
        </symbol>
    </svg>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted, nextTick, useTemplateRef, watch } from 'vue';
import { OriginMode } from '../../../base/cot.ts';
import Subscription from '../../../base/subscription.ts';
import RadialMenu from './RadialMenu.js';
import './RadialMenu.css';
import { useMapStore } from '../../../stores/map.ts';
import mapgl from 'maplibre-gl';

const mapStore = useMapStore();

const props = defineProps({
    size: {
        type: Number,
        default: 200
    }
});

const emit = defineEmits(['close', 'click']);

const iconsRef = useTemplateRef('icons');
const menuItems = ref([]);
const menu = shallowRef();
const popup = shallowRef();
const cot = shallowRef();

watch(() => cot.value?.geometry, (newGeometry) => {
    if (popup.value && newGeometry && newGeometry.type === 'Point') {
        popup.value.setLngLat(newGeometry.coordinates);
    }
});

let timer;
onUnmounted(() => {
    if (timer) clearInterval(timer);
    if (menu.value) {
        menu.value.close();
    }
    if (popup.value) {
        popup.value.remove();
    }
});

onMounted(async () => {
    await genMenuItems();

    nextTick(() => {
        const container = document.createElement('div');
        container.style.width = `${props.size}px`;
        container.style.height = `${props.size}px`;

        if (iconsRef.value) {
            container.appendChild(iconsRef.value.cloneNode(true));
        }

        menu.value = new RadialMenu({
            parent: container,
            size: props.size,
            closeOnClick: true,
            menuItems: menuItems.value,
            onClick: (item) => {
                emit('click', `${mapStore.radial.mode}:${item.id}`);
            },
            onClose: () => {
                emit('close');
            }
        });
        menu.value.open();

        if (mapStore.radial.lngLat) {
             popup.value = new mapgl.Popup({
                closeButton: false,
                closeOnClick: true,
                maxWidth: 'none',
                anchor: 'center',
                className: 'radial-menu-popup'
            })
            .setLngLat(mapStore.radial.lngLat)
            .setDOMContent(container)
            .addTo(mapStore.map);

            popup.value.on('close', () => {
                emit('close');
            });
        } else {
            emit('close');
        }

        timer = setInterval(async () => {
            if (cot.value) {
                const updated = await mapStore.worker.db.get(cot.value.properties.id || cot.value.id, {
                    mission: true
                });
                if (updated) cot.value = updated;
            }
        }, 500);
    })
});

async function genMenuItems() {
    menuItems.value.splice(0, menuItems.value.length);
    if (mapStore.radial.mode === 'cot') {
        if (mapStore.radial.cot && mapStore.radial.cot.properties) {
            cot.value = await mapStore.worker.db.get(mapStore.radial.cot.properties.id, {
                mission: true
            });

            if (!cot.value) throw new Error('Could not find marker');

            if (cot.value.origin.mode === OriginMode.CONNECTION) {
                menuItems.value.push({ id: 'edit', icon: '#radial-pencil' })
                menuItems.value.push({ id: 'delete', icon: '#radial-trash' })

                if (cot.value.geometry.type === 'Point') {
                    menuItems.value.push({ id: 'lock', icon: '#radial-lock' })
                }
            } else if (cot.value.origin.mode === OriginMode.MISSION && cot.value.origin.mode_id) {

                const sub = await Subscription.from(cot.value.origin.mode_id, localStorage.token);

                if (sub.role && sub.role.permissions.includes("MISSION_WRITE")) {
                    menuItems.value.push({ id: 'edit', icon: '#radial-pencil' })
                    menuItems.value.push({ id: 'delete', icon: '#radial-trash' })
                }
            }

            if (cot.value.properties.video) {
                menuItems.value.push({ id: 'play', icon: '#radial-play' })
            }
        }

        menuItems.value.push({ id: 'view', icon: '#radial-view' })
    } else if (mapStore.radial.mode === 'feat') {
        menuItems.value.push({ id: 'view', icon: '#radial-view' })
    } else if (mapStore.radial.mode === 'context') {
        menuItems.value.push({ id: 'new', icon: '#radial-pencil-plus' })
        menuItems.value.push({ id: 'info', icon: '#radial-question' })
    }
}
</script>
