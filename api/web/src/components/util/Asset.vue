<template>
<div>
</div>
</template>

<script>
export default {
    name: 'Asset',
    props: {
        asset: {
            type: Number,
            required: true
        }
    },
    data: function() {
        return {
            a: {}
        }
    },
    mounted: function() {
        this.fetch();
    },
    methods: {
        try {

        } catch (err) {
            this.$emit('err', err);
        }
    },
}
</script>
