<template>
<span class="status-indicator status-indicator-animated" :class='{
    "status-green": connection.status === "healthy",
    "status-red": connection.status === "alarm",
    "status-dark": connection.status === "unknown",
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
