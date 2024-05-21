<template>
    <div v-for='sub of subscriptions'>
        <div class='col-12 py-2 d-flex hover-dark'>
            <div class='row col-12 align-items-center'>
                <div class='col-auto mx-2'>
                    <div v-text='sub.username' />
                    <div
                        class='subheader'
                        v-text='sub.username'
                    />
                </div>
                <div class='col-auto ms-auto btn-list'>
                    <span v-text='sub.role.type' />
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'MissionUsers',
    props: {
        subscriptions: Array
    },
}
</script>
