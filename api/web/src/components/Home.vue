<template>
<CloudTAK v-if='user' :user='user'/>
</template>

<script>
import CloudTAK from './CloudTAK/Map.vue';

export default {
    name: 'Home',
    props: {
        user: {
            type: Object,
            required: true
        }
    },
    components: {
        CloudTAK
    }
}
</script>
