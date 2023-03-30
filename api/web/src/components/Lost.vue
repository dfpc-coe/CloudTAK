<template>
<div class="page page-center">
    <div class="container-tight py-4">
        <div class="empty">
            <div class="empty-header">404</div>
            <p class="empty-title">Oops… You just found an error page</p>
            <p class="empty-subtitle text-muted">
                We are sorry but the page you are looking for was not found
            </p>
            <div class="empty-action">
                <a @click="$router.push('/')" class="cursor-pointer btn btn-primary">
                    Home
                </a>
            </div>
        </div>
    </div>
</div>
</template>

<script>
export default {
    name: 'Lost'
}
</script>
