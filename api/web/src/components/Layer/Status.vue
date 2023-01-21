<template>
<span class="status-indicator status-indicator-animated" :class='{
    "status-green": layer.status === "healthy",
    "status-red": layer.status === "alarm",
    "status-dark": layer.status === "unknown",
}'>
      <span class="status-indicator-circle"></span>
      <span class="status-indicator-circle"></span>
      <span class="status-indicator-circle"></span>
</span>
</template>

<script>
export default {
    name: 'LayerStatus',
    props: {
        layer: Object
    }
}
</script>
