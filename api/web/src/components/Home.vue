<template>
<div>
    <div class='page-body'>
        <div class='container-xl'>
        </div>
    </div>

    <PageFooter/>
</div>
</template>

<script>
import PageFooter from './PageFooter.vue';

export default {
    name: 'Home',
    data: function() {
        return {
            err: false,
        }
    },
    mounted: function() {
    },
    methods: {
    },
    components: {
        PageFooter,
    }
}
</script>
