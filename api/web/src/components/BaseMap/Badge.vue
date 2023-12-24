<template>
<span v-if='type === "raster"' class='badge mx-1 mb-1 bg-red text-white'>Raster</span>
<span v-else-if='type === "raster"' class='badge mx-1 mb-1 border border-red text-red'>Raster-DEM</span>
<span v-else-if='type === "vector"' class='badge mx-1 mb-1 bg-blue text-white'>Vector</span>
</template>

<script>
export default {
    name: 'BaseMapBadge',
    props: {
        type: {
            type: String,
            required: true
        }
    }
}
</script>
