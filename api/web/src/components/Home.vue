<template>
  <CloudTAK
    v-if='user'
    :user='user'
  />
</template>

<script>
import CloudTAK from './CloudTAK/Map.vue';

export default {
    name: 'CloudTAKHome',
    components: {
        CloudTAK
    },
    props: {
        user: {
            type: Object,
            required: true
        }
    }
}
</script>
