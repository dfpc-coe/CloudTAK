<template>
    <div
        ref='radialMenu'
        class='position-absolute'
        style='pointer-events: none;'
        :style='{
            top: `${y - (size / 2) - 13}px`,
            left: `${x - (size / 2) - 8}px`,
        }'
    ></div>

     <svg id="icons" class='d-none'>
         <symbol id="radial-trash" viewBox="0 0 24 24" stroke-width="2" stroke="#fff" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></symbol>
         <symbol id="radial-view" viewBox="0 0 24 24" stroke-width="2" stroke="#fff" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M13 5h8" /><path d="M13 9h5" /><path d="M13 15h8" /><path d="M13 19h5" /><path d="M3 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M3 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /></symbol>
     </svg>
</template>

<script>
import RadialMenu from './RadialMenu.js';
import './RadialMenu.css';
import {
    TrashIcon
} from 'vue-tabler-icons';

export default {
    name: 'RadialMenu',
    emits: ['close', 'click'],
    props: {
        x: {
            type: Number,
            default: 0
        },
        y: {
            type: Number,
            default: 0
        },
        size: {
            type: Number,
            default: 200
        },
    },
    data: function() {
        return {
            menu: null
        }
    },
    mounted: function() {
        this.$nextTick(() => {
            this.menu = new RadialMenu({
                parent: this.$refs.radialMenu,
                size: this.size,
                closeOnClick: true,
                menuItems: [{
                    id: 'cot',
                    icon: '#radial-view'
                },{
                    id: 'delete',
                    icon: '#radial-trash'
                }],
                onClick: (item) => {
                    this.$emit('click', item);
                },
                onClose: () => {
                    this.$emit('close')
                }
            });
            this.menu.open();
        })
    },
    components: {
        TrashIcon
    }
}
</script>
