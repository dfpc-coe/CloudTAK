<template>
    <div>
        <Chart :connection='connection' />
        <Events />
    </div>
</template>

<script>
import Chart from './Chart.vue';
import Events from './Events.vue';

export default {
    name: 'ConnectionHealth',
    components: {
        Chart,
        Events
    },
    props: {
        connection: {
            type: Object,
            required: true
        }
    }
}
</script>
