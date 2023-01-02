<template>
<div class="page page-center">
    <div class="container container-normal py-4">
        <div class="row align-items-center g-4">
            <div class="col-lg">
                <div class="container-tight">
                    <div class="card card-md">
                        <div class="card-body">
                            <h2 class="h2 text-center mb-4">Login to your account</h2>
                            <div class="mb-3">
                                <label class="form-label">Username or Email</label>
                                <input v-model='username' v-on:keyup.enter='createLogin' type="text" class="form-control" placeholder="your@email.com" autocomplete="off">
                            </div>
                            <div class="mb-2">
                                <label class="form-label">
                                    Password
                                    <span class="form-label-description">
                                        <!--<a href="./forgot-password.html">Forgot Password</a>-->
                                    </span>
                                </label>
                                <div class="input-group input-group-flat">
                                    <input v-model='password' v-on:keyup.enter='createLogin' type="password" class="form-control" placeholder="Your password" autocomplete="off">
                                </div>
                            </div>
                            <div class="form-footer">
                              <button @click='createLogin' type="submit" class="btn btn-primary w-100">Sign In</button>
                            </div>
                        </div>
                    </div>
                    <div class="text-center text-muted mt-3">
                        <!--Don't have account yet? <a href='mailto:rescue@ingalls.ca'>Contact Us</a>-->
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
</template>

<script>
export default {
    name: 'Login',
    data: function() {
        return {
            username: '',
            password: ''
        }
    },
    methods: {
        createLogin: async function() {
            const login = await window.std('/api/login', {
                method: 'POST',
                body: {
                    username: this.username,
                    password: this.password
                }
            });

            localStorage.token = login.token;

            this.$router.push("/");
        }
    }
}
</script>
