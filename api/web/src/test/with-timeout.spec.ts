import { afterEach, describe, expect, it, vi } from 'vitest'
import { TimeoutError, withTimeout } from '../base/async.ts'

describe('withTimeout', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('resolves with the promise value when it settles in time', async () => {
        await expect(withTimeout(Promise.resolve('ok'), 1000, 'Test')).resolves.toBe('ok')
    })

    it('rejects with the promise error when it fails in time', async () => {
        await expect(withTimeout(Promise.reject(new Error('boom')), 1000, 'Test')).rejects.toThrow('boom')
    })

    it('rejects with a labeled TimeoutError when the deadline passes first', async () => {
        vi.useFakeTimers()

        const pending = withTimeout(new Promise(() => {}), 5000, 'Slow lookup')
        const assertion = Promise.all([
            expect(pending).rejects.toThrow('Slow lookup timed out after 5000ms'),
            expect(pending).rejects.toBeInstanceOf(TimeoutError)
        ])

        await vi.advanceTimersByTimeAsync(5000)
        await assertion
    })

    it('does not surface a late rejection as unhandled', async () => {
        vi.useFakeTimers()

        let rejectLate!: (err: Error) => void
        const late = new Promise<never>((_, reject) => { rejectLate = reject })

        const pending = withTimeout(late, 1000, 'Test')
        const assertion = expect(pending).rejects.toThrow('timed out')

        await vi.advanceTimersByTimeAsync(1000)
        await assertion

        // The loser of the race rejecting afterwards must be swallowed;
        // vitest fails this test automatically on an unhandled rejection.
        rejectLate(new Error('late failure'))
        await vi.runAllTimersAsync()
    })
})
