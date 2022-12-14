<template>
<div>
    I'm an ASSET!
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
    mounted: async function() {
        await this.fetch();
    },
    methods: {
    },
}
</script>
