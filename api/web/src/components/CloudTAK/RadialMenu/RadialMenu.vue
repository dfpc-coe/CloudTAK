<template>
    <div
        ref='radialMenu'
        class='position-absolute'
        :style='{
            top: `${y - (size / 2) - 15}px`,
            left: `${x - (size / 2) - 15}px`,
        }'
    ></div>
</template>

<script>
import RadialMenu from './RadialMenu.js';
import './RadialMenu.css';

export default {
    name: 'RadialMenu',
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
                    id: 'item1', title: 'Item 1'
                },{
                    id: 'item2', title: 'Item 2'
                },{
                    id: 'more',
                    title: 'More...',
                    items: [{
                        id: 'subitem1', title: 'Subitem 1'
                    },{
                        id: 'item2', title: 'Subitem 2' }
                    ]
                }],
                onClick: (item) => {
                    console.log('You have clicked:', item);
                },
                onClose: () => {
                    this.$emit('close')
                }
            });
            this.menu.open();
        })
    }
}
</script>
