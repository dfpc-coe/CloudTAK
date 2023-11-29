<template>
<MissionList :modal='false'/>
</template>

<script>
import MissionList from '../../Mission/MissionList.vue';

export default {
    name: 'Missions',
    components: {
        MissionList,
    }
}
</script>
