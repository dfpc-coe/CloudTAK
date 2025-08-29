import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import type { Router } from 'vue-router'
import type { Pinia } from 'pinia'
import Login from '../components/Login.vue'
import { useBrandStore } from '../stores/brand'

// Mock the std module
vi.mock('../std.ts', () => ({
    std: vi.fn(),
}))

describe('Login.vue', () => {
    let wrapper: VueWrapper<any> | null
    let router: Router
    let pinia: Pinia
    let mockStd: any

    beforeEach(async () => {
        // Create fresh instances for each test
        pinia = createPinia()
        setActivePinia(pinia)

        router = createRouter({
            history: createWebHistory(),
            routes: [
                { path: '/', component: { template: '<div>Home</div>' } },
                { path: '/login', component: { template: '<div>Login</div>' } },
                { path: '/admin', component: { template: '<div>Admin</div>' } },
            ],
        })

        // Start at login page to avoid router warnings
        await router.push('/login')
        await router.isReady()

        // Reset mocks
        mockStd = vi.fn()
        const stdModule = await import('../std.ts')
        vi.mocked(stdModule.std).mockImplementation(mockStd)

        // Clear localStorage mock
        vi.clearAllMocks()
    })

    afterEach(() => {
        if (wrapper) {
            wrapper.unmount()
            wrapper = null
        }
    })

    const createWrapper = async (brandStoreData: Record<string, unknown> = {}) => {
        const brandStore = useBrandStore()

        // Setup brand store with default or custom data
        brandStore.$patch({
            loaded: true,
            login: {
                logo: '/test-logo.svg',
                forgot: 'http://example.com/forgot',
                signup: 'http://example.com/signup',
                ...brandStoreData,
            },
        })

        wrapper = mount(Login, {
            global: {
                plugins: [router, pinia],
                stubs: {
                    // Stub the router-link to avoid navigation issues
                    'router-link': true,
                },
            },
        })

        await wrapper!.vm.$nextTick()
        return wrapper
    }

    describe('Component Rendering', () => {
        it('renders loading state when brand store is not loaded', async () => {
            const brandStore = useBrandStore()
            brandStore.$patch({ loaded: false })

            wrapper = mount(Login, {
                global: {
                    plugins: [router, pinia],
                },
            })

            await wrapper!.vm.$nextTick()

            expect(wrapper!.find('[data-testid="tabler-loading"]').exists()).toBe(true)
            expect(wrapper.text()).toContain('Loading CloudTAK')
        })

        it('renders login form when brand store is loaded', async () => {
            await createWrapper()

            expect(wrapper!.find('h2').text()).toBe('Login to your account')
            expect(wrapper!.findAll('[data-testid="tabler-input"]')).toHaveLength(2)
            expect(wrapper!.find('button[type="submit"]').text()).toBe('Sign In')
        })

        it('displays custom logo when provided in brand store', async () => {
            await createWrapper({ logo: '/custom-logo.png' })

            const logoImg = wrapper!.find('img[alt="CloudTAK System Logo"]')
            expect(logoImg.attributes('src')).toBe('/custom-logo.png')
        })

        it('displays default logo when no custom logo is provided', async () => {
            await createWrapper({ logo: null })

            const logoImg = wrapper!.find('img[alt="CloudTAK System Logo"]')
            expect(logoImg.attributes('src')).toBe('/CloudTAKLogo.svg')
        })

        it('shows forgot password link when configured', async () => {
            await createWrapper({ forgot: 'http://example.com/forgot-password' })

            const forgotLink = wrapper!.find('a[href="http://example.com/forgot-password"]')
            expect(forgotLink.exists()).toBe(true)
            expect(forgotLink.text()).toBe('Forgot Password')
        })

        it('shows signup link when configured', async () => {
            await createWrapper({ signup: 'http://example.com/register' })

            const signupLink = wrapper!.find('a[href="http://example.com/register"]')
            expect(signupLink.exists()).toBe(true)
            expect(signupLink.text()).toBe('Sign Up')
        })
    })

    describe('Form Input Handling', () => {
        it('updates username when input changes', async () => {
            await createWrapper()

            const usernameInput = wrapper!.findAll('[data-testid="tabler-input-field"]')[0]
            await usernameInput.setValue('testuser')

            expect(wrapper!.vm.body.username).toBe('testuser')
        })

        it('updates password when input changes', async () => {
            await createWrapper()

            const passwordInput = wrapper!.findAll('[data-testid="tabler-input-field"]')[1]
            await passwordInput.setValue('testpassword')

            expect(wrapper!.vm.body.password).toBe('testpassword')
        })

        it('has correct input types and placeholders', async () => {
            await createWrapper()

            const inputs = wrapper!.findAll('[data-testid="tabler-input-field"]')

            expect(inputs[0].attributes('type')).toBe('text')
            expect(inputs[0].attributes('placeholder')).toBe('your@email.com')

            expect(inputs[1].attributes('type')).toBe('password')
            expect(inputs[1].attributes('placeholder')).toBe('Your password')
        })
    })

    describe('Login Submission', () => {
        it('calls std with correct parameters for email login', async () => {
            await createWrapper()

            mockStd.mockResolvedValue({ token: 'test-token' })

            // Test with mixed case email to verify it's preserved
            wrapper!.vm.body.username = 'Test.User@Example.com'
            wrapper!.vm.body.password = 'password123'

            await wrapper!.vm.createLogin()

            expect(mockStd).toHaveBeenCalledWith('/api/login', {
                method: 'POST',
                body: {
                    username: 'Test.User@Example.com',
                    password: 'password123',
                },
            })
        })

        it('calls std with correct parameters for username login', async () => {
            await createWrapper()

            mockStd.mockResolvedValue({ token: 'test-token' })

            wrapper!.vm.body.username = 'TestUser123'
            wrapper!.vm.body.password = 'password123'

            await wrapper!.vm.createLogin()

            expect(mockStd).toHaveBeenCalledWith('/api/login', {
                method: 'POST',
                body: {
                    username: 'TestUser123',
                    password: 'password123',
                },
            })
        })

        it('stores token in localStorage on successful login', async () => {
            await createWrapper()

            mockStd.mockResolvedValue({ token: 'test-jwt-token' })

            wrapper!.vm.body.username = 'testuser'
            wrapper!.vm.body.password = 'password123'

            await wrapper!.vm.createLogin()

            expect(localStorage.setItem).toHaveBeenCalledWith('token', 'test-jwt-token')
        })

        it('emits login event on successful login', async () => {
            await createWrapper()

            mockStd.mockResolvedValue({ token: 'test-token' })

            wrapper!.vm.body.username = 'testuser'
            wrapper!.vm.body.password = 'password123'

            await wrapper!.vm.createLogin()

            expect(wrapper!.emitted('login')).toHaveLength(1)
        })

        it('shows loading state during login', async () => {
            await createWrapper()

            // Make the promise not resolve immediately
            let resolvePromise: any
            const slowPromise = new Promise(resolve => {
                resolvePromise = resolve
            })
            mockStd.mockReturnValue(slowPromise)

            // Start login process
            const loginPromise = wrapper!.vm.createLogin()

            // Check loading state immediately
            expect(wrapper!.vm.loading).toBe(true)

            // Resolve the promise
            resolvePromise({ token: 'test-token' })
            await loginPromise

            // Wait for next tick to ensure navigation happens
            await wrapper!.vm.$nextTick()

            // Loading should still be true since successful login doesn't reset it
            // (The component expects to navigate away on successful login)
            expect(wrapper!.vm.loading).toBe(true)
        })
    })

    describe('Error Handling', () => {
        it('resets loading state when login fails', async () => {
            await createWrapper()

            mockStd.mockRejectedValue(new Error('Invalid credentials'))

            wrapper!.vm.body.username = 'testuser'
            wrapper!.vm.body.password = 'wrongpassword'

            try {
                await wrapper!.vm.createLogin()
            } catch {
                // Expected to throw
            }

            expect(wrapper!.vm.loading).toBe(false)
        })

        it('preserves form data when login fails', async () => {
            await createWrapper()

            mockStd.mockRejectedValue(new Error('Network error'))

            wrapper!.vm.body.username = 'testuser'
            wrapper!.vm.body.password = 'password123'

            try {
                await wrapper!.vm.createLogin()
            } catch {
                // Expected to throw
            }

            expect(wrapper!.vm.body.username).toBe('testuser')
            expect(wrapper!.vm.body.password).toBe('password123')
        })

        it('re-throws error for external handling', async () => {
            await createWrapper()

            const testError = new Error('API Error')
            mockStd.mockRejectedValue(testError)

            await expect(wrapper!.vm.createLogin()).rejects.toThrow('API Error')
        })
    })

    describe('Username Handling', () => {
        const testCases = [
            // All inputs should be passed through unchanged
            { input: 'user@example.com', expected: 'user@example.com' },
            { input: 'test.email@domain.co.uk', expected: 'test.email@domain.co.uk' },
            { input: 'Test.Email@DOMAIN.CO.UK', expected: 'Test.Email@DOMAIN.CO.UK' },
            { input: 'USER@EXAMPLE.COM', expected: 'USER@EXAMPLE.COM' },
            { input: 'username', expected: 'username' },
            { input: 'user123', expected: 'user123' },
            { input: 'test_user', expected: 'test_user' },
            { input: '@incomplete', expected: '@incomplete' },
            { input: 'no-at-symbol.com', expected: 'no-at-symbol.com' },
        ]

        testCases.forEach(({ input, expected }) => {
            it(`correctly handles "${input}" without modification`, async () => {
                await createWrapper()

                mockStd.mockResolvedValue({ token: 'test-token' })

                wrapper!.vm.body.username = input
                wrapper!.vm.body.password = 'password123'

                await wrapper!.vm.createLogin()

                expect(mockStd).toHaveBeenCalledWith('/api/login', {
                    method: 'POST',
                    body: {
                        username: expected,
                        password: 'password123',
                    },
                })
            })
        })
    })

    describe('Brand Store Integration', () => {
        it('initializes brand store on component mount', async () => {
            const brandStore = useBrandStore()
            const initSpy = vi.spyOn(brandStore, 'init')

            await createWrapper()

            expect(initSpy).toHaveBeenCalled()
        })
    })

    describe('Navigation After Login', () => {
        it('navigates to redirect URL when provided and not login page', async () => {
            await router.push('/login?redirect=/admin')
            await router.isReady()
            await createWrapper()

            const pushSpy = vi.spyOn(router, 'push')
            mockStd.mockResolvedValue({ token: 'test-token' })

            await wrapper!.vm.createLogin()

            expect(pushSpy).toHaveBeenCalledWith('/admin')
        })

        it('navigates to home when redirect is login page', async () => {
            await router.push('/login?redirect=/login')
            await router.isReady()
            await createWrapper()

            const pushSpy = vi.spyOn(router, 'push')
            mockStd.mockResolvedValue({ token: 'test-token' })

            await wrapper!.vm.createLogin()

            expect(pushSpy).toHaveBeenCalledWith('/')
        })

        it('navigates to home when no redirect URL is provided', async () => {
            await router.push('/login')
            await router.isReady()
            await createWrapper()

            const pushSpy = vi.spyOn(router, 'push')
            mockStd.mockResolvedValue({ token: 'test-token' })

            await wrapper!.vm.createLogin()

            expect(pushSpy).toHaveBeenCalledWith('/')
        })
    })
})
