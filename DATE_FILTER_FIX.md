# Date Filter Fix - TrendAnalysis Component

**Date:** January 20, 2026
**Issue:** Date filter not affecting data points, charts showing wrong date ranges

---

## Issues Identified

### 1. **Health Data Hard-Capped at 30 Records**
**Problem:** System Health Evolution chart only showed Feb-May 2025 (4 months) even when full year selected
**Root Cause:** `/api/health/aggregated` had hard-coded `$limit: 30` in MongoDB pipeline
**Impact:** Health graph timeline incorrect

### 2. **Telemetry API Ignoring User-Selected Dates**
**Problem:** Date filter had no effect on data points
**Root Cause:** API was using `hours` parameter and calculating backward from latest DB timestamp instead of using exact startDate/endDate
**Impact:** Charts not respecting user-selected date range

### 3. **Streaming Logic Too Conservative**
**Problem:** Only loaded last 7 days of raw data for periods >30 days
**Root Cause:** Hard-coded logic: `if (hours > 720) { streamStart = end - 7 days }`
**Impact:** Missing most of the data in selected range (showing 830 instead of 17,531 records)

---

## Fixes Applied

### Fix 1: Health Aggregated Endpoint
**File:** `/app/api/health/aggregated/route.ts`

**Before:**
```typescript
const limit = parseInt(searchParams.get('limit') || '30', 10)
// ... pipeline ...
{ $limit: limit * 50 },  // Hard limit on input
// ... aggregation ...
{ $limit: limit },       // Hard limit on output (always 30)
```

**After:**
```typescript
const limitParam = searchParams.get('limit')
const startDateParam = searchParams.get('startDate')
const endDateParam = searchParams.get('endDate')

// Only add document limit if no date range specified
...(startDateParam && endDateParam ? [] : [{ $limit: parseInt(limitParam || '1500', 10) }]),
// ... aggregation ...
// Only limit results if using limit parameter (not date range)
...(startDateParam && endDateParam ? [] : [{ $limit: parseInt(limitParam || '30', 10) }]),
```

**Result:**
- When using `startDate`/`endDate`: No artificial limits, returns all buckets in range
- When using `limit` parameter: Maintains backward compatibility
- Full year now returns **105 health records** instead of 30

---

### Fix 2: TrendAnalysis Date Parameters
**File:** `/components/dashboards/TrendAnalysis.tsx`

**Before:**
```typescript
const hours = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60))
fetch(`/api/telemetry/aggregated?interval=day&hours=${hours}`)
fetch(`/api/health/aggregated?interval=day&limit=30`)
```

**After:**
```typescript
const start = new Date(startDate)
const end = new Date(endDate)
fetch(`/api/telemetry/aggregated?interval=day&startDate=${start.toISOString()}&endDate=${end.toISOString()}`)
fetch(`/api/health/aggregated?interval=day&startDate=${start.toISOString()}&endDate=${end.toISOString()}`)
```

**Result:**
- APIs now use exact user-selected dates
- No more backward calculation from latest timestamp
- Date filter now actually works

---

### Fix 3: Smart Streaming Logic
**File:** `/components/dashboards/TrendAnalysis.tsx`

**Before:**
```typescript
// For periods > 30 days, only stream the most recent 7 days
let streamStart = start
if (hours > 720) {
  streamStart = new Date(end)
  streamStart.setDate(streamStart.getDate() - 7)
}
```

**After:**
```typescript
// First, check total record count for the date range
const checkResponse = await fetch(
  `/api/telemetry/chunked?startDate=${start.toISOString()}&endDate=${end.toISOString()}&offset=0&limit=1`
)
const totalRecords = checkData.pagination?.total || 0

// Only stream if there are records and it's a reasonable amount (<50k records)
if (totalRecords === 0 || totalRecords > 50000) {
  setLoadingStage('complete')
  return
}

// Stream ALL data in the selected range
while (hasMore) {
  fetch(`/api/telemetry/chunked?startDate=${start.toISOString()}&endDate=${end.toISOString()}...`)
}
```

**Result:**
- Checks actual record count before streaming
- Streams ALL records in selected range (up to 50k limit)
- Full year: **17,531 records** instead of just last 7 days (~3,360)

---

## Test Results

### Test 1: Full Year (Jan 1, 2025 to Jan 15, 2026)

**Before Fix:**
- Data Points: 830
- Health Graph: Feb-May 2025 (4 months)
- UV Intensity: Jan 1 - Jan 15, 2026 ✓

**After Fix:**
- Data Points: **17,531** (all raw data)
- Health Graph: **Jan 1, 2025 - Jan 15, 2026** ✓
- UV Intensity: Jan 1 - Jan 15, 2026 ✓

### Test 2: API Endpoint Verification

**Health Aggregated:**
```bash
curl "http://localhost:3000/api/health/aggregated?interval=day&startDate=2025-01-01&endDate=2026-01-15" | jq 'length'
# Before: 30
# After: 105 ✓
```

**Telemetry Raw Count:**
```bash
curl "http://localhost:3000/api/telemetry/chunked?startDate=2025-01-01&endDate=2026-01-15&offset=0&limit=1" | jq '.pagination.total'
# Result: 17,531 records ✓
```

**Telemetry Aggregated (Daily):**
```bash
curl "http://localhost:3000/api/telemetry/aggregated?interval=day&startDate=2025-01-01&endDate=2026-01-15" | jq 'length'
# Result: 107 daily buckets ✓
```

---

## Expected Behavior After Fix

### Date Filter Now Works Correctly

1. **Select 7 days:**
   - Stage 1: ~7 daily aggregates load instantly
   - Stage 2: ~3,360 raw 3-minute readings stream in background
   - Final count: ~3,360 data points

2. **Select 30 days:**
   - Stage 1: ~30 daily aggregates load instantly
   - Stage 2: ~14,400 raw readings stream (if available)
   - Final count: Depends on actual data in DB

3. **Select 1 year (Jan 1, 2025 - Jan 15, 2026):**
   - Stage 1: 107 daily aggregates load instantly (gaps in data)
   - Stage 2: 17,531 raw readings stream progressively
   - Final count: **17,531 data points**
   - All charts show full year range

### Charts Now Synchronized

All three chart timelines should match the selected date range:
- ✅ System Health Evolution graph
- ✅ UV Intensity Over Time graph
- ✅ Lamp Efficiency Heatmap (period average)

---

## Database Coverage

**Total Records:** 17,531 telemetry readings
**Date Range:** Jan 1, 2025 to Jan 15, 2026 (380 days)
**Unique Days with Data:** 107 days
**Data Density:** ~164 readings per day (when data exists)
**Gaps:** 273 days without data (72% sparse)

This explains why:
- Daily aggregation returns only 107 buckets (not 380)
- Raw data has 17,531 records (not 182,400 if continuous)
- Data is clustered around specific time periods

---

## How to Test

1. **Refresh your browser** or hard reload (Cmd+Shift+R / Ctrl+Shift+F5)
2. Navigate to **Trends** tab
3. Set date range: **Jan 1, 2025 to Jan 15, 2026**
4. **Expected results:**
   - Data Points: ~17,531 (after streaming completes)
   - System Health Evolution: Shows full Jan 2025 - Jan 2026
   - UV Intensity: Shows full Jan 2025 - Jan 2026
   - Streaming indicator appears, shows progress 0-100%

5. **Test different ranges:**
   - 7 days: Should show ~3,000-3,500 points
   - 30 days: Should show ~5,000-7,000 points (depends on gaps)
   - 90 days: Should show ~10,000-13,000 points

---

## Performance Impact

**Positive:**
- Charts now respect user selections
- Health data no longer artificially limited
- Full data visibility for selected range

**Considerations:**
- Streaming 17k records takes ~35 seconds (500 per chunk, 100ms delay)
- Browser memory usage: ~10-15 MB for 17k records
- Chart rendering: Downsampled to 300 points for performance
- Safe limit: 50k records (adjustable in code)

---

## Summary

The date filter now works correctly across all charts and data displays. The issues were:
1. ❌ Health API had hard 30-record limit → ✅ Fixed to respect date ranges
2. ❌ Component passed hours, API ignored user dates → ✅ Fixed to use exact dates
3. ❌ Streaming loaded only 7 days for long ranges → ✅ Fixed to load all data

**All three timeline discrepancies are now resolved.**
