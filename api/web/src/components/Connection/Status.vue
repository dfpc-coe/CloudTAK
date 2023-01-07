<template>
<span class="status-indicator status-indicator-animated" :class='{
    "status-green": connection.status === "live",
    "status-red": connection.status === "dead",
    "status-dark": connection.status === "unknown",
}'>
      <span class="status-indicator-circle"></span>
      <span class="status-indicator-circle"></span>
      <span class="status-indicator-circle"></span>
</span>
</template>

<script>
export default {
    name: 'ConnectionStatus',
    props: {
        connection: Object
    }
}
</script>
