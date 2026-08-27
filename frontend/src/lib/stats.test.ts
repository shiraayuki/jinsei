import { describe, expect, it } from 'vitest'
import {
  adherence, byWeek, byWeekday, clockToNightAxis, correlation, densify, lag,
  latest, movingAverage, nightAxisToClock, shareAtLeast, sleepMidpoint,
  slopePerDay, socialJetlag, stdDev,
} from './stats'

const p = (date: string, value: number | null) => ({ date, value })

describe('movingAverage', () => {
  it('skips gaps instead of counting them as zero', () => {
    const result = movingAverage([p('2026-08-01', 10), p('2026-08-02', null), p('2026-08-03', 20)], 2, 1)
    expect(result.map(r => r.value)).toEqual([10, null, 15])
  })

  it('stays null until enough readings are behind it', () => {
    const result = movingAverage([p('2026-08-01', 10), p('2026-08-02', 20), p('2026-08-03', 30)], 4, 3)
    expect(result.map(r => r.value)).toEqual([null, null, 20])
  })
})

describe('slopePerDay', () => {
  it('measures against the calendar, not the index', () => {
    // Two readings a fortnight apart, one kilo down: 1/14 kg a day.
    const points = [p('2026-08-01', 80), p('2026-08-08', 79.5), p('2026-08-15', 79)]
    expect(slopePerDay(points)!).toBeCloseTo(-1 / 14, 6)
  })

  it('needs three readings before it says anything', () => {
    expect(slopePerDay([p('2026-08-01', 80), p('2026-08-08', 79)])).toBeNull()
  })
})

describe('correlation', () => {
  it('pairs on the date and reports how many pairs it found', () => {
    const a = [p('2026-08-01', 1), p('2026-08-02', 2), p('2026-08-03', 3), p('2026-08-04', null)]
    const b = [p('2026-08-01', 2), p('2026-08-02', 4), p('2026-08-03', 6), p('2026-08-04', 8)]
    const result = correlation(a, b)!
    expect(result.r).toBeCloseTo(1, 6)
    expect(result.n).toBe(3)
  })

  it('returns null when one side never varies', () => {
    const flat = [p('2026-08-01', 5), p('2026-08-02', 5), p('2026-08-03', 5)]
    const rising = [p('2026-08-01', 1), p('2026-08-02', 2), p('2026-08-03', 3)]
    expect(correlation(flat, rising)).toBeNull()
  })
})

describe('lag', () => {
  it('credits a night to the day it has to carry', () => {
    expect(lag([p('2026-08-01', 420)], 1)).toEqual([p('2026-08-02', 420)])
  })
})

describe('socialJetlag', () => {
  it('measures the shift between working days and free ones', () => {
    // Mondays and Tuesdays centred at 3:00, Saturday and Sunday at 5:00.
    const midpoints = [
      p('2026-08-24', 180), p('2026-08-25', 180),
      p('2026-08-29', 300), p('2026-08-30', 300),
    ]
    expect(socialJetlag(midpoints)).toBe(120)
  })

  it('needs both sides before it says anything', () => {
    expect(socialJetlag([p('2026-08-24', 180)])).toBeNull()
  })
})

describe('shareAtLeast', () => {
  it('counts the readings that reach the threshold', () => {
    const result = shareAtLeast([p('a', 400), p('b', 460), p('c', null), p('d', 480)], 450)!
    expect(result.hit).toBe(2)
    expect(result.total).toBe(3)
  })
})

describe('adherence', () => {
  it('counts the days inside the tolerance band', () => {
    const result = adherence([p('a', 2000), p('b', 2300), p('c', 1900)], 2000, 0.1)!
    expect(result.hit).toBe(2)
    expect(result.total).toBe(3)
  })
})

describe('byWeek', () => {
  it('anchors buckets on Monday and can sum or average', () => {
    // 2026-08-24 is a Monday; 2026-08-23 the Sunday before it.
    const points = [p('2026-08-23', 10), p('2026-08-24', 20), p('2026-08-25', 40)]
    expect(byWeek(points, 'sum').map(b => [b.date, b.value])).toEqual([
      ['2026-08-17', 10],
      ['2026-08-24', 60],
    ])
    expect(byWeek(points, 'mean')[1].value).toBe(30)
  })
})

describe('byWeekday', () => {
  it('indexes Monday first', () => {
    const result = byWeekday([p('2026-08-24', 5), p('2026-08-30', 9)])
    expect(result[0]).toBe(5)
    expect(result[6]).toBe(9)
    expect(result[3]).toBeNull()
  })
})

describe('densify', () => {
  it('fills every calendar day between the bounds', () => {
    const result = densify([p('2026-08-03', 7)], '2026-08-01', '2026-08-04')
    expect(result.map(r => r.value)).toEqual([null, null, 7, null])
  })
})

describe('latest and stdDev', () => {
  it('ignores the trailing gap', () => {
    expect(latest([p('a', 1), p('b', 2), p('c', null)])).toBe(2)
  })

  it('needs two readings for a spread', () => {
    expect(stdDev([5])).toBeNull()
    expect(stdDev([10, 20])!).toBeCloseTo(7.0710678, 5)
  })
})

describe('clock times on the night axis', () => {
  it('puts late evening and the small hours next to each other', () => {
    const late = clockToNightAxis('23:50')!
    const early = clockToNightAxis('00:10')!
    expect(early - late).toBe(20)
  })

  it('round-trips back to a clock', () => {
    expect(nightAxisToClock(clockToNightAxis('22:30')!)).toBe('22:30')
    expect(nightAxisToClock(clockToNightAxis('05:00')!)).toBe('05:00')
  })

  it('places the midpoint of a night that crosses midnight', () => {
    // 22:30 to 07:30 is nine hours, so the middle is 03:00.
    expect(nightAxisToClock(sleepMidpoint('22:30', '07:30')!)).toBe('03:00')
  })

  it('has no midpoint without both times', () => {
    expect(sleepMidpoint('22:30', null)).toBeNull()
  })
})
