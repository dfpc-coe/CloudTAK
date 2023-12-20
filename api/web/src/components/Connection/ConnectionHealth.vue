<template>
<Chart :connection='connection'/>
<Events/>
</template>

<script>
import Chart from './Chart.vue';
import Events from './Events.vue';

export default {
    name: 'ConnectionHealth',
    props: {
        connection: {
            type: Object,
            required: true
        }
    },
    components: {
        Chart,
        Events
    }
}
</script>
