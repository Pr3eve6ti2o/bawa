// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'

import {
  AUTO_LOCK_LABELS,
  AUTO_LOCK_MINUTES_KEY,
  AUTO_LOCK_OPTIONS,
  autoLockDurationMs,
  readAutoLockEnabled,
  readAutoLockMinutes,
  writeAutoLockEnabled,
  writeAutoLockMinutes,
} from './auto-lock'

beforeEach(() => {
  localStorage.clear()
})

describe('auto-lock', () => {
  it('defaults to disabled when storage is empty', () => {
    expect(readAutoLockEnabled()).toBe(false)
  })

  it('defaults to five minutes when storage is empty', () => {
    expect(readAutoLockMinutes()).toBe(5)
  })

  it('round-trips the enabled setting', () => {
    writeAutoLockEnabled(true)

    expect(readAutoLockEnabled()).toBe(true)
  })

  it('round-trips the disabled setting after auto-lock was enabled', () => {
    writeAutoLockEnabled(true)
    writeAutoLockEnabled(false)

    expect(readAutoLockEnabled()).toBe(false)
  })

  it('exposes exactly the supported minute options', () => {
    expect(AUTO_LOCK_OPTIONS).toEqual([0, 1, 5, 15, 60, 1440])
  })

  it.each(AUTO_LOCK_OPTIONS)(
    'round-trips the %i-minute option',
    (minutes) => {
      writeAutoLockMinutes(minutes)

      expect(readAutoLockMinutes()).toBe(minutes)
    },
  )

  it.each(['2', 'abc', ''])(
    'falls back to five minutes for the invalid stored value %j',
    (storedMinutes) => {
      localStorage.setItem(AUTO_LOCK_MINUTES_KEY, storedMinutes)

      expect(readAutoLockMinutes()).toBe(5)
    },
  )

  it('reads a stored zero as a valid immediate-lock setting', () => {
    localStorage.setItem(AUTO_LOCK_MINUTES_KEY, '0')

    expect(readAutoLockMinutes()).toBe(0)
  })

  it.each([2, 7, -1])(
    'ignores the unsupported %i-minute value and preserves the previous setting',
    (minutes) => {
      writeAutoLockMinutes(15)
      const previousStoredMinutes = localStorage.getItem(AUTO_LOCK_MINUTES_KEY)

      writeAutoLockMinutes(minutes)

      expect(localStorage.getItem(AUTO_LOCK_MINUTES_KEY)).toBe(
        previousStoredMinutes,
      )
      expect(readAutoLockMinutes()).toBe(15)
    },
  )

  it.each([
    [0, 0],
    [1, 60_000],
    [5, 300_000],
    [15, 900_000],
    [60, 3_600_000],
    [1440, 86_400_000],
  ])('converts %i minutes to %i milliseconds', (minutes, milliseconds) => {
    expect(autoLockDurationMs(minutes)).toBe(milliseconds)
  })

  it.each(AUTO_LOCK_OPTIONS)(
    'provides a non-empty label for the %i-minute option',
    (minutes) => {
      expect(AUTO_LOCK_LABELS[minutes]).toEqual(expect.stringMatching(/\S/))
    },
  )

  it('labels the zero-minute option as Immediately', () => {
    expect(AUTO_LOCK_LABELS[0]).toBe('Immediately')
  })
})
