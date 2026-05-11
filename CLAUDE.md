# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

This is a **BWTS (Ballast Water Treatment System) IoT Monitoring Dashboard** built with Next.js 16, featuring a distinctive radial design with a central diamond lamp array. The dashboard monitors UV lamp performance, predictive maintenance, compliance status, and historical trends.

**Key Technologies:**
- Next.js 16+ (App Router)
- TypeScript (strict mode)
- MongoDB Atlas (cloud database)
- Tailwind CSS 4 + shadcn/ui
- Recharts for data visualization
- Progressive Data Loading (instant render + background streaming)

**Production Status:** ✅ Ready for deployment (Build passes, all features functional)

---

## Development Commands

```bash
# Development server (runs on port 3000)
npm run dev

# Production build
npm run build

# Start production server (port 3000)
npm start

# Linting
npm run lint
```

---

## Environment Configuration

Required environment variables in `.env.local`:

```bash
MONGODB_URI=<your-mongodb-connection-string>
MONGODB_DB=demo
MONGODB_COLLECTION_PREFIX=bwts_iot
```

**MongoDB Collections:**
- `bwts_iot_telemetry` - Real-time sensor readings
- `bwts_iot_health_scores` - System health metrics
- `bwts_iot_events` - Process events and alarms
- `bwts_iot_predictions` - ML predictions for maintenance
- `bwts_iot_voyage_schedule` - Voyage planning data

---

## Architecture

### Data Flow Pattern

```
Dashboard Component (Client)
  ↓ fetch('/api/...')
API Route Handler (Server)
  ↓ getTelemetryCollection()
MongoDB Helper (lib/mongodb.ts)
  ↓ MongoDB Atlas
Database Collections
```

**Important:** All dashboard components are client-side (`'use client'`) and fetch data from Next.js API routes. Never query MongoDB directly from client components.

### File Structure

```
app/
├── api/                    # Server-side API routes
│   ├── telemetry/
│   │   ├── latest/        # GET /api/telemetry/latest
│   │   ├── history/       # GET /api/telemetry/history
│   │   ├── aggregated/    # GET /api/telemetry/aggregated (NEW - daily/hourly buckets)
│   │   └── chunked/       # GET /api/telemetry/chunked (NEW - paginated streaming)
│   ├── health/
│   │   ├── route.ts       # GET /api/health
│   │   └── aggregated/    # GET /api/health/aggregated (NEW - time-bucketed health)
│   ├── events/            # GET /api/events
│   ├── predictions/       # GET /api/predictions
│   └── stats/             # GET /api/stats (aggregated data)
├── globals.css            # Tailwind config + custom CSS variables
├── layout.tsx             # Root layout with DM Sans font
└── page.tsx               # Main dashboard with tab navigation

components/
├── dashboards/            # 6 main dashboard views
│   ├── FluidOverview.tsx           # Real-time monitoring (central lamp array)
│   ├── PredictiveMaintenance.tsx   # Maintenance scheduling
│   ├── TrendAnalysis.tsx           # Historical trends
│   ├── ComplianceMonitoring.tsx    # IMO D-2 / USCG compliance
│   ├── ComparativeAnalysis.tsx     # Lamp-to-lamp comparison
│   └── DataExport.tsx              # CSV/PDF export
└── ui/                    # shadcn/ui components

lib/
├── mongodb.ts             # MongoDB connection & collection helpers
├── types.ts               # TypeScript interfaces (TelemetryReading, HealthScore, etc.)
├── constants.ts           # Thresholds, gradients, refresh intervals
└── utils.ts               # Utility functions (cn for className merging)
```

---

## MongoDB Connection Pattern

**Always use the helper functions from `lib/mongodb.ts`:**

```typescript
import { getTelemetryCollection, getHealthCollection } from '@/lib/mongodb'

// In API routes
export async function GET() {
  const collection = await getTelemetryCollection()
  const data = await collection.find({}).sort({ timestamp: -1 }).limit(10).toArray()
  return NextResponse.json(data)
}
```

**Connection Behavior:**
- Development: Uses global singleton to prevent connection exhaustion
- Production: Creates new connection per request
- Connection string from `MONGODB_URI` env variable
- Database name from `MONGODB_DB` env variable
- Collection prefix from `MONGODB_COLLECTION_PREFIX` env variable

---

## TypeScript Types

All data interfaces are defined in `lib/types.ts`:

- **TelemetryReading** - Sensor data with UV, flow, pressure, lamp status (16 lamps)
- **HealthScore** - Overall system health + component breakdowns
- **Prediction** - ML predictions for remaining useful life & failure probability
- **Event** - Process events (PROCESS_START, PROCESS_STOP, ALARM_TRIGGERED)
- **LampStatus** - Individual lamp data (id, status, power, runtime, efficiency)

**Lamp Data Pattern:**
```typescript
// Telemetry includes LAMP_01 through LAMP_16
interface TelemetryReading {
  LAMP_01_STATUS: string
  LAMP_01_POWER: number
  LAMP_01_RUNTIME: number
  LAMP_01_EFFICIENCY: number
  // ... repeated for LAMP_02 through LAMP_16
}

// Access dynamically
const lampId = 5
const status = telemetry[`LAMP_${String(lampId).padStart(2, '0')}_STATUS`]
```

---

## Design System

### Radial Layout Philosophy

The dashboard uses a **"gravitational" design** where:
- The 16-lamp diamond array is the central "sun"
- Key metrics float at viewport edges
- No harsh borders or card containers
- Status indicators use gradient colors with glow effects
- Typography hierarchy replaces visual containers

### Color System

**Status Gradients:**
- **Green** (`from-green-500 to-green-600`) - Excellent (90%+ efficiency)
- **Yellow** (`from-yellow-500 to-yellow-600`) - Good (70-90%)
- **Orange** (`from-orange-500 to-orange-600`) - Warning (50-70%)
- **Red** (`from-red-500 to-red-600`) - Critical (<50%)

**Metric Categories (Stat Cards):**
- **Cyan** - UV intensity readings (changed from purple to avoid confusion with health graph)
- **Purple** - Health trend and calendar metrics
- **Orange** - Efficiency metrics
- **Blue** - Flow rate, pressure, and data points
- **Emerald/Red** - Dynamic health trends (based on positive/negative)

**Background:**
```tsx
style={{
  background: 'radial-gradient(ellipse at center, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)'
}}
```

### Typography

- **Font:** DM Sans (loaded in layout.tsx via Google Fonts)
- **Labels:** 10px uppercase with letter-spacing
- **Metrics:** text-3xl to text-4xl with font-light
- **Body:** text-sm with regular weight

---

## Key Constants (lib/constants.ts)

```typescript
THRESHOLDS = {
  UV_INTENSITY: {
    USCG_MIN: 530,    // W/m² - USCG compliance minimum
    IMO_MIN: 252,     // W/m² - IMO D-2 compliance minimum
    OPTIMAL: 650,     // W/m² - Target operating point
  },
  LAMP_EFFICIENCY: {
    GOOD: 90,         // >= 90%
    WARNING: 70,      // 70-89%
    CRITICAL: 50,     // < 50%
  },
  LAMP_RUNTIME: {
    MAX: 3000,        // hours - Expected lamp lifetime
    WARNING: 2500,    // hours - Maintenance warning threshold
  },
}

REFRESH_INTERVAL = 30000  // 30 seconds - Dashboard auto-refresh

LOADING_CONFIG = {
  CHUNK_SIZE: 500,        // Records per chunk when streaming
  STREAM_DELAY: 100,      // Milliseconds between chunk loads
  MAX_CHART_POINTS: 300,  // Downsample charts to this many points
}
```

---

## Progressive Data Loading

**Implemented in:** TrendAnalysis, ComparativeAnalysis, DataExport

### Two-Stage Loading Pattern

**Stage 1 - Instant Render (<500ms):**
- Fetches daily/hourly aggregated data (~30-100 points)
- Charts render immediately with coarse data
- Provides instant visual feedback

**Stage 2 - Background Streaming:**
- Streams raw 3-minute interval data in 500-record chunks
- Progressively replaces aggregated data with raw data
- Shows subtle progress indicator (bottom-right)
- No UI blocking - user can interact immediately

### Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Initial Load Time | 2-5 seconds | <500ms | **6-10x faster** |
| Initial Payload | 2-5 MB | ~50 KB | **40-100x smaller** |
| Time to Interaction | 2-5 seconds | <500ms | **Instant** |
| Data Points (1 year) | Limited | 17,531 | **Full dataset** |

### API Endpoints for Progressive Loading

```typescript
// Stage 1: Aggregated data
GET /api/telemetry/aggregated?interval=day&startDate=2025-01-01&endDate=2026-01-15
GET /api/health/aggregated?interval=day&startDate=2025-01-01&endDate=2026-01-15

// Stage 2: Chunked streaming
GET /api/telemetry/chunked?startDate=2025-01-01&endDate=2026-01-15&offset=0&limit=500
```

### Component Implementation Pattern

```typescript
'use client'

import { useState, useEffect } from 'react'
import { LoadingStage, ChunkedResponse, TelemetryReading } from '@/lib/types'
import { LOADING_CONFIG } from '@/lib/constants'

export default function ProgressiveDashboard() {
  const [data, setData] = useState<TelemetryReading[]>([])
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('initial')
  const [streamProgress, setStreamProgress] = useState(0)

  // Stage 1: Load aggregated data
  useEffect(() => {
    const fetchAggregated = async () => {
      setLoadingStage('initial')
      const response = await fetch('/api/telemetry/aggregated?interval=day&hours=720')
      const aggregated = await response.json()
      setData(aggregated)
      setLoadingStage('streaming')
    }
    fetchAggregated()
  }, [])

  // Stage 2: Stream raw data
  useEffect(() => {
    if (loadingStage !== 'streaming') return

    const streamRawData = async () => {
      let offset = 0
      let hasMore = true

      while (hasMore) {
        const response = await fetch(`/api/telemetry/chunked?offset=${offset}&limit=500`)
        const chunk: ChunkedResponse<TelemetryReading> = await response.json()

        // Merge chunk into existing data
        setData(prevData => [...prevData, ...chunk.data].sort(...))
        setStreamProgress((offset + 500) / chunk.pagination.total * 100)

        offset += 500
        hasMore = chunk.pagination.hasMore
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      setLoadingStage('complete')
    }
    streamRawData()
  }, [loadingStage])

  return (
    <div>
      {/* Charts render immediately with aggregated data */}
      {loadingStage === 'streaming' && (
        <div className="fixed bottom-4 right-4">
          Loading detailed data... {streamProgress.toFixed(0)}%
        </div>
      )}
    </div>
  )
}
```

---

## API Routes

### Available Endpoints

| Endpoint | Method | Description | Returns |
|----------|--------|-------------|---------|
| `/api/telemetry/latest` | GET | Most recent telemetry reading | Single TelemetryReading |
| `/api/telemetry/history` | GET | Historical telemetry (query params: `hours`, `limit`) | Array of TelemetryReading |
| `/api/telemetry/aggregated` | GET | Daily/hourly aggregated data (`interval`, `startDate`, `endDate`) | Array of Aggregated Data |
| `/api/telemetry/chunked` | GET | Paginated streaming (`startDate`, `endDate`, `offset`, `limit`) | ChunkedResponse |
| `/api/telemetry/runtime-analysis` | GET | **NEW** - Runtime-based telemetry for all 16 lamps (`startDate`, `endDate`) | Array of TelemetryReading with lamp runtime/efficiency/power |
| `/api/health` | GET | Latest health score | Single HealthScore |
| `/api/health/aggregated` | GET | Time-bucketed health scores (`interval`, `startDate`, `endDate`) | Array of Aggregated Health |
| `/api/events` | GET | Recent events (default: last 10) | Array of Event |
| `/api/predictions` | GET | Current predictions for all components | Array of Prediction |
| `/api/stats` | GET | Aggregated dashboard stats | Combined object |

### API Route Pattern

All routes use this structure:

```typescript
import { NextResponse } from 'next/server'
import { getTelemetryCollection } from '@/lib/mongodb'

export async function GET() {
  try {
    const collection = await getTelemetryCollection()
    const data = await collection.find({}).toArray()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}

// Disable caching for real-time data
export const dynamic = 'force-dynamic'
export const revalidate = 0
```

---

## Dashboard Components

### Component Pattern

All dashboard components follow this structure:

```typescript
'use client'

import { useEffect, useState } from 'react'

export default function DashboardName() {
  const [data, setData] = useState<DataType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/endpoint')
        const result = await response.json()
        setData(result)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return <div>Loading...</div>

  return <div>{/* Dashboard content */}</div>
}
```

### Dashboard Tabs

1. **FluidOverview** - Central 16-lamp diamond array with real-time metrics
2. **PredictiveMaintenance** - Maintenance calendar, failure predictions, RUL bars
3. **TrendAnalysis** - Progressive loading, full-width UV chart, hourly trends, date filters, **runtime analysis graphs** (Lamp Efficiency & Power vs Runtime, Lamp Efficiency vs System UV Intensity) with single lamp selection
4. **ComplianceMonitoring** - IMO D-2/USCG compliance checklists, audit trail
5. **ComparativeAnalysis** - Hourly lamp comparison (Lamp 1 vs 16 default), NO ROI data
6. **DataExport** - Excel-style column filters, CSV/PDF export, progressive loading

---

## Adding New Features

### Adding a New API Route

1. Create route file: `app/api/your-route/route.ts`
2. Import MongoDB helper
3. Export GET/POST/etc. handler
4. Add `export const dynamic = 'force-dynamic'` for real-time data

### Adding a New Dashboard Component

1. Create component: `components/dashboards/YourDashboard.tsx`
2. Add `'use client'` directive
3. Follow the fetch-on-mount + auto-refresh pattern
4. Import in `app/page.tsx`
5. Add tab to `tabs` array
6. Add conditional render in tab content section

### Adding New TypeScript Types

1. Define interfaces in `lib/types.ts`
2. Export for use across the app
3. Ensure MongoDB field names match exactly (MongoDB is case-sensitive)

---

## Important Notes

### MongoDB Query Performance

- Always use `.sort({ timestamp: -1 })` for latest-first ordering
- Use `.limit()` to cap result sets (avoid loading entire collections)
- Create indexes on `timestamp` field for better performance
- Use aggregation pipeline for complex queries (see `/api/stats`)

### Client-Side Data Fetching

- All dashboards use client-side fetching (not SSR)
- Auto-refresh implemented with `setInterval`
- Error handling with try/catch + user-friendly messages
- Loading states for better UX

### Styling Conventions

- Use Tailwind utility classes (not custom CSS)
- Gradient backgrounds with `bg-gradient-to-br`
- Glow effects with inline `boxShadow` styles
- Responsive design with `min-h-screen`, `px-8`, `pt-24`
- Glassmorphism with `backdrop-blur-sm` + `bg-white/80`

### shadcn/ui Components

The project uses shadcn/ui components from `components/ui/`:
- `Tabs` - For tabbed interfaces
- `Card` - For card layouts (though used sparingly in radial design)
- `Progress` - For progress bars
- `Alert` - For status messages
- `Badge` - For status indicators
- `Table` - For data tables
- `Button` - For interactive elements

**Import pattern:**
```typescript
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
```

---

## Troubleshooting

### MongoDB Connection Issues

- Verify `MONGODB_URI` in `.env.local` is correct
- Check network access in MongoDB Atlas (whitelist IP)
- Ensure database name matches `MONGODB_DB` env variable
- Collection names must follow pattern: `{MONGODB_COLLECTION_PREFIX}_telemetry`

### Port Already in Use

The app runs on port 3000. If you see "Port 3000 is already in use":
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or change port in package.json scripts
"dev": "next dev -p 3001"
```

### TypeScript Errors

- Run `npm run build` to check for type errors
- Ensure all MongoDB fields match types in `lib/types.ts`
- Use optional chaining (`?.`) for fields that might be undefined

### Data Not Updating

- Check API route is returning fresh data (not cached)
- Verify `export const dynamic = 'force-dynamic'` in route
- Check browser console for fetch errors
- Confirm MongoDB collections have recent data

---

## Recent Changes (January 2026)

### Runtime Analysis Graphs ✅ (Latest)
- **New API endpoint**: `/api/telemetry/runtime-analysis` - Fetches lamp data organized by cumulative runtime hours
- **Two new graphs in TrendAnalysis**:
  1. **Lamp Efficiency & Power vs Runtime** - Dual Y-axis chart showing efficiency degradation (purple solid line) and power compensation (blue dashed line) over operating hours
  2. **Lamp Efficiency vs System UV Intensity** - Dual Y-axis chart showing efficiency (purple solid line) against UV intensity (cyan dashed line) over runtime hours
- **Single lamp selection**: Both graphs use dropdown to select one lamp at a time for focused analysis
- **10-hour bucketing**: Runtime data grouped into 10-hour intervals for cleaner visualization
- **Insight**: Shows lamp degradation patterns based on cumulative runtime rather than chronological time, providing better maintenance insights

### Progressive Data Loading Implementation ✅
- **Two-stage loading**: Instant aggregated data → background streaming
- **New API routes**: `/api/telemetry/aggregated`, `/api/telemetry/chunked`, `/api/health/aggregated`
- **Performance**: 6-10x faster initial load (<500ms vs 2-5s)
- **Components updated**: TrendAnalysis, ComparativeAnalysis, DataExport

### Bug Fixes ✅
1. **Date Filter**: Now works correctly across all tabs (uses `startDate`/`endDate` params)
2. **Health Chart Timeline**: Fixed hard 30-record limit, now shows full date range
3. **UV Intensity Color**: Changed from purple to cyan to avoid confusion with health graph
4. **Double Dollar Sign**: Removed from Predictive tab (Est. Savings stat)
5. **UV Chart Layout**: Made full-width with angled labels, lamp heatmap moved below

### UI Improvements ✅
1. **TrendAnalysis**: Full-width UV chart, 8x2 lamp heatmap grid, cyan UV stat color, runtime analysis graphs
2. **ComparativeAnalysis**: Hourly grouping (~79 points vs 10), Lamp 1 & 16 defaults, removed unsupported ROI data, removed all-lamps degradation graph (staggered runtime data made it meaningless)
3. **DataExport**: Excel-style column filters with funnel icons, text & number filters with AND logic

### Production Readiness ✅
- **Build Status**: ✅ Passes (`npm run build`)
- **TypeScript**: ✅ Compiles successfully
- **Lint**: ⚠️ 22 non-blocking warnings (acceptable for production)
- **Performance**: ✅ All optimizations applied
- **Documentation**: See `PRODUCTION_READINESS.md` for full details

---

## Related Documentation

For detailed implementation plans and reports, refer to:
- `/Users/sriram/.claude/plans/master-plan.md` - Overall project roadmap
- `/Users/sriram/.claude/plans/dashboard-*-subplan.md` - Individual dashboard specs
- `/Users/sriram/Developer/IOT/BWTS IOT data/DATA_REFERENCE_GUIDE.md` - Data schema reference
- `PRODUCTION_READINESS.md` - Build status, deployment checklist, performance metrics
- `IMPLEMENTATION_SUMMARY.md` - Progressive loading implementation details
- `DATE_FILTER_FIX.md` - Date filter bug fixes and timeline synchronization
