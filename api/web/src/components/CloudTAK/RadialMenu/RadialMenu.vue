<template>
    <div
        ref='radialMenu'
        class='position-absolute'
        style='pointer-events: none;'
        :style='{
            top: `${y - (size / 2)}px`,
            left: `${x - (size / 2) - 5}px`,
        }'
    ></div>

     <svg id="icons" class='d-none'>
         <symbol id='radial-question' viewBox="0 0 24 24" stroke-width="2" stroke="#fff" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 8a3.5 3 0 0 1 3.5 -3h1a3.5 3 0 0 1 3.5 3a3 3 0 0 1 -2 3a3 4 0 0 0 -2 4" /><path d="M12 19l0 .01" /></symbol>
         <symbol id='radial-trash' viewBox="0 0 24 24" stroke-width="2" stroke="#fff" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></symbol>
         <symbol id='radial-view' viewBox="0 0 24 24" stroke-width="2" stroke="#fff" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M13 5h8" /><path d="M13 9h5" /><path d="M13 15h8" /><path d="M13 19h5" /><path d="M3 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M3 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /></symbol>
         <symbol id='radial-pencil' viewBox="0 0 24 24" stroke-width="2" stroke="#fff" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" /></symbol>
         <symbol id='radial-pencil-plus' viewBox="0 0 24 24" stroke-width="2" stroke="#fff" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" /><path d="M16 19h6" /><path d="M19 16v6" /></symbol>
     </svg>
</template>

<script>
import RadialMenu from './RadialMenu.js';
import './RadialMenu.css';

export default {
    name: 'RadialMenu',
    emits: ['close', 'click'],
    props: {
        mode: {
            type: String,
            required: true
        },
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
    watch: {
        mode: function() {

        }
    },
    data: function() {
        return {
            menuItems: [],
            menu: null
        }
    },
    mounted: function() {
        this.genMenuItems();

        this.$nextTick(() => {
            this.menu = new RadialMenu({
                parent: this.$refs.radialMenu,
                size: this.size,
                closeOnClick: true,
                menuItems: this.menuItems,
                onClick: (item) => {
                    this.$emit('click', `${this.mode}:${item}`);
                },
                onClose: () => {
                    this.$emit('close')
                }
            });
            this.menu.open();
        })
    },
    methods: {
        genMenuItems: function() {
            this.menuItems.splice(0, this.menuItems.length);
            if (this.mode === 'cot') {
                this.menuItems.push({ id: 'edit', icon: '#radial-pencil' })
                this.menuItems.push({ id: 'cot', icon: '#radial-view' })
                this.menuItems.push({ id: 'delete', icon: '#radial-trash' })
            } else if (this.mode === 'context') {
                this.menuItems.push({ id: 'new', icon: '#radial-pencil-plus' })
                this.menuItems.push({ id: 'info', icon: '#radial-question' })
            }
        }
    }
}
</script>
