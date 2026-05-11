# BWTS Monitoring Dashboard - Production Ready ✅

A modern, high-performance dashboard for monitoring Ballast Water Treatment Systems (BWTS) with progressive data loading and a distinctive radial design.

## Production Status

**Status:** ✅ **READY FOR PRODUCTION**
**Build:** ✅ PASSED
**Lint:** ⚠️ 22 non-blocking warnings
**Last Updated:** January 20, 2026

See [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) for full deployment checklist.

## Key Features

- **Progressive Data Loading**: Instant render with aggregated data (~50 KB), then background streaming of detailed records
- **Real-Time Monitoring**: 30-second auto-refresh for live telemetry data
- **Central Diamond Lamp Array**: 16 UV lamps displayed in a diamond pattern as the focal point
- **Historical Trend Analysis**: Date-range filtering with full-year data support (17,531 records)
- **Predictive Maintenance**: ML-based failure predictions and RUL tracking
- **Compliance Tracking**: IMO D-2 and USCG regulatory compliance monitoring
- **Data Export**: Excel-style filtering with CSV/PDF export capabilities

## Performance Metrics

| Metric | Before Optimization | After Optimization | Improvement |
|--------|--------------------|--------------------|-------------|
| Initial Load Time | 2-3 seconds | <500ms | **6x faster** |
| Initial Payload | 2-5 MB | ~50 KB | **40-100x smaller** |
| Chart Render | ~500ms | <100ms | **5x faster** |
| Full Dataset | Limited | 17,531 records | **Complete** |

## Design System

### Color Palette

| Element | Color | Usage |
|---------|-------|-------|
| Excellent | Green gradient | 90%+ efficiency |
| Good | Yellow gradient | 70-90% efficiency |
| Warning | Orange gradient | 50-70% efficiency |
| Critical | Red gradient | <50% efficiency |
| UV Metrics | **Cyan** | UV intensity readings (changed from purple) |
| Health Metrics | Purple | Overall health scores |
| Flow Metrics | Blue | Flow rate, pressure |
| Power Metrics | Orange | Power output |

### Typography

- **Font**: DM Sans (Google Fonts)
- **Labels**: 10px uppercase with letter-spacing
- **Metrics**: 3xl-4xl light weight
- **Body**: sm regular weight

## Installation

### Prerequisites

- Node.js 18+ (compatible with Node 20+)
- MongoDB Atlas account with connection string
- npm or yarn package manager

### Quick Start

1. **Clone or extract the project**

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**

   Create `.env.local` file in the root directory:
   ```bash
   MONGODB_URI=mongodb+srv://your-connection-string
   MONGODB_DB=demo
   MONGODB_COLLECTION_PREFIX=bwts_iot
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Deployment

```bash
# Build for production
npm run build

# Start production server
npm start

# Runs on http://localhost:3000
```

## File Structure

```
bwts_final/
├── app/
│   ├── api/                          # API routes (all server-side)
│   │   ├── telemetry/
│   │   │   ├── latest/route.ts       # Latest reading
│   │   │   ├── history/route.ts      # Historical data
│   │   │   ├── aggregated/route.ts   # Daily/hourly aggregates (NEW)
│   │   │   └── chunked/route.ts      # Paginated streaming (NEW)
│   │   ├── health/
│   │   │   ├── route.ts              # Latest health score
│   │   │   └── aggregated/route.ts   # Health aggregates (NEW)
│   │   ├── events/route.ts           # System events
│   │   ├── predictions/route.ts      # ML predictions
│   │   └── stats/route.ts            # Dashboard statistics
│   ├── globals.css                   # Tailwind + glassmorphism styles
│   ├── layout.tsx                    # Root layout with DM Sans font
│   └── page.tsx                      # Main dashboard with tabs
├── components/
│   ├── dashboards/
│   │   ├── FluidOverview.tsx         # Real-time overview (central lamp array)
│   │   ├── PredictiveMaintenance.tsx # Maintenance scheduling & predictions
│   │   ├── TrendAnalysis.tsx         # Historical trends (progressive loading)
│   │   ├── ComplianceMonitoring.tsx  # IMO D-2 / USCG compliance
│   │   ├── ComparativeAnalysis.tsx   # Lamp comparison (hourly data)
│   │   └── DataExport.tsx            # CSV/PDF export with filters
│   └── ui/                           # shadcn/ui components
├── lib/
│   ├── types.ts                      # TypeScript interfaces
│   ├── mongodb.ts                    # MongoDB connection helpers
│   ├── constants.ts                  # Thresholds, gradients, config
│   └── utils.ts                      # Utility functions
├── CLAUDE.md                         # Developer documentation
├── PRODUCTION_READINESS.md           # Deployment guide
└── README.md                         # This file
```

## Dashboard Tabs

1. **Overview** - Real-time monitoring with central 16-lamp diamond array, live telemetry metrics, and system health gauge
2. **Predictive** - Maintenance scheduling, failure probability predictions, RUL (Remaining Useful Life) tracking, cost savings analysis
3. **Trends** - Historical analysis with progressive loading, full-year date range filtering, full-width UV charts, hourly trends, lamp efficiency heatmap, **runtime analysis graphs** (Efficiency & Power vs Runtime, Efficiency vs UV Intensity) with single lamp selection dropdown
4. **Compliance** - IMO D-2 and USCG regulatory compliance tracking, audit trail, effectiveness timeline
5. **Comparative** - Hourly lamp-to-lamp efficiency comparison (Lamp 1 vs Lamp 16 default), 30-day analysis with progressive data loading
6. **Export** - Excel-style column filtering, CSV/PDF export with customizable date ranges, progressive data loading

## Progressive Data Loading

The dashboard implements a two-stage progressive loading system for optimal performance:

### Stage 1: Instant Render (~500ms)
- Fetches **daily aggregated data** (~30 records for 30 days)
- Payload size: **~50 KB** (vs 2-5 MB previously)
- Charts render immediately with coarse-grained data
- User sees results instantly

### Stage 2: Background Streaming
- Streams **raw 3-minute interval data** in 500-record chunks
- Total dataset: **17,531 records** (1 year of data)
- Charts progressively refine as data loads
- Subtle progress indicator in bottom-right
- Non-blocking: user can interact while loading

### Benefits
- **6x faster** initial load time
- **40-100x smaller** initial payload
- **Complete dataset** access (no truncation)
- **Smooth UX** (no loading spinners)

## API Routes

### Real-Time Data
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/telemetry/latest` | GET | Most recent telemetry reading |
| `/api/health` | GET | Latest health score |
| `/api/events` | GET | Recent system events (default: last 10) |
| `/api/predictions` | GET | Current ML predictions for all components |
| `/api/stats` | GET | Aggregated dashboard statistics |

### Progressive Loading (NEW)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/telemetry/aggregated` | GET | Daily/hourly time-bucketed aggregates |
| `/api/telemetry/chunked` | GET | Paginated raw data (500 records/chunk) |
| `/api/telemetry/runtime-analysis` | GET | Runtime-based telemetry for all 16 lamps (for degradation analysis) |
| `/api/health/aggregated` | GET | Daily/hourly health score aggregates |

### Query Parameters

**Aggregated endpoints:**
- `interval`: `day` or `hour` (aggregation bucket size)
- `startDate`: ISO date string (start of range)
- `endDate`: ISO date string (end of range)
- `hours`: Alternative to dates - hours from latest timestamp

**Chunked endpoint:**
- `startDate`: ISO date string (required)
- `endDate`: ISO date string (required)
- `offset`: Skip N records (pagination)
- `limit`: Records per chunk (default: 500)

## Recent Changes (January 2026)

### Runtime Analysis Graphs ✅ (Latest)
- **New Feature**: Added runtime-based degradation analysis in Trends tab
- **API Endpoint**: `/api/telemetry/runtime-analysis` - Fetches lamp data organized by cumulative runtime hours
- **Graph 1**: Lamp Efficiency & Power vs Runtime - Shows efficiency degradation (purple line) and power compensation (blue dashed line)
- **Graph 2**: Lamp Efficiency vs System UV Intensity - Shows efficiency vs UV intensity correlation over runtime hours
- **Single Lamp Selection**: Dropdown selector for focused individual lamp analysis
- **10-Hour Bucketing**: Runtime data grouped into 10-hour intervals for cleaner visualization
- **Key Insight**: Analyzes lamp degradation based on cumulative operating hours (not chronological time) for better maintenance planning
- **Removed**: All-lamps degradation graph from Comparative tab (staggered runtime data made it ineffective)

### Progressive Data Loading Implementation ✅
- Added `/api/telemetry/aggregated` route for instant daily/hourly aggregates
- Added `/api/telemetry/chunked` route for paginated streaming
- Added `/api/health/aggregated` route for health score aggregates
- Implemented two-stage loading in TrendAnalysis and ComparativeAnalysis components
- Reduced initial load time from 2-3s to <500ms

### Bug Fixes ✅
1. **Date Filter Not Working** - Fixed API calls to use explicit `startDate`/`endDate` parameters instead of calculated hours
2. **Health Chart Timeline Mismatch** - Removed hard 30-record limit in health aggregation API
3. **Incomplete Data Streaming** - Fixed streaming logic to check total record count and load all data (up to 50k records)
4. **TypeScript Build Error** - Added index signature to `TelemetryReading` interface and type guards for dynamic lamp field access
5. **Double Dollar Sign** - Removed redundant "$" text in Predictive Maintenance tab

### UI Improvements ✅
1. **UV Chart Layout** - Changed to full-width layout with angled X-axis labels for better readability
2. **Lamp Heatmap Position** - Moved below UV chart in 8×2 grid layout (was side-by-side)
3. **Color Scheme Update** - Changed UV Intensity stat color from purple to cyan to avoid confusion with health graph
4. **Runtime Analysis Graphs** - Added two dual Y-axis charts in Trends tab with single lamp dropdown selection

### Code Quality ✅
- Fixed 17 ESLint issues (from 39 to 22 non-blocking warnings)
- Removed unused imports and variables
- Added proper TypeScript interfaces for all data types
- Fixed React unescaped entities
- Added memoization for performance optimization
- Production build passes cleanly

## Design Philosophy

The dashboard uses a **radial, gravitational layout** where:

- The lamp array is the central "sun" that everything orbits around
- Key metrics float at the edges of the viewport
- Status indicators use color gradients with subtle glow effects
- No harsh borders or containers break the visual flow
- Typography hierarchy replaces visual containers

## Customization

### Changing Colors

Edit the gradient classes in each component:
```tsx
// Green status
className="bg-gradient-to-br from-green-500 to-green-600"
style={{ boxShadow: '0 4px 20px rgba(34, 197, 94, 0.4)' }}
```

### Background Gradient

In `page.tsx`:
```tsx
style={{ 
  background: 'radial-gradient(ellipse at center, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)' 
}}
```

## Technology Stack

- **Framework:** Next.js 16.1.3 (App Router)
- **Language:** TypeScript 5+ (strict mode)
- **Database:** MongoDB Atlas (cloud-hosted)
- **Styling:** Tailwind CSS 4 + custom glassmorphism utilities
- **UI Components:** shadcn/ui
- **Charts:** Recharts (responsive line charts, heatmaps)
- **Font:** DM Sans (Google Fonts)
- **Node:** Compatible with Node 18+

## MongoDB Configuration

### Required Collections
The database must have the following collections with the specified prefix (default: `bwts_iot`):

- `bwts_iot_telemetry` - Real-time sensor readings (17,531 records for demo)
- `bwts_iot_health_scores` - System health metrics
- `bwts_iot_events` - Process events and alarms
- `bwts_iot_predictions` - ML predictions for maintenance
- `bwts_iot_voyage_schedule` - Voyage planning data (optional)

### Environment Variables
```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB=demo
MONGODB_COLLECTION_PREFIX=bwts_iot
```

### Data Structure
- **Timespan:** 1 year of data (sparse - 107 unique days)
- **Interval:** 3-minute telemetry readings
- **Total Records:** 17,531 telemetry readings
- **Lamps:** 16 UV lamps (LAMP_01 through LAMP_16)
- **Ports:** 13 international ports
- **Operations:** BALLAST and DEBALLAST cycles

## Testing & Verification

### Development Testing
```bash
# Run development server
npm run dev

# Test checklist:
# ✅ Homepage loads at http://localhost:3000
# ✅ All 6 dashboard tabs are functional
# ✅ Date filters work correctly (Trends & Comparative tabs)
# ✅ Charts render without errors
# ✅ Progressive loading indicator appears briefly
# ✅ Data updates every 30 seconds
# ✅ Export functions work (CSV/PDF)
```

### Production Build Testing
```bash
# Build for production
npm run build

# Expected output:
# ✓ Compiled successfully
# ✓ Running TypeScript ... PASSED
# ✓ Collecting page data ... PASSED
# ✓ Generating static pages ... PASSED

# Run production build
npm start

# Verify all features work in production mode
```

### ESLint Check
```bash
npm run lint

# Expected: 22 non-blocking warnings (acceptable for production)
# All critical errors should be resolved
```

## Troubleshooting

### MongoDB Connection Issues
- Verify `MONGODB_URI` includes correct credentials
- Check MongoDB Atlas network access (whitelist your IP)
- Ensure database name matches `MONGODB_DB` env variable
- Collection names must follow pattern: `{MONGODB_COLLECTION_PREFIX}_telemetry`

### Port Conflicts
The app runs on **port 3000**. If you see "Port already in use":
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or change port in package.json
"dev": "next dev -p 3001"
```

### Build Errors
- Run `npm run build` to check for TypeScript errors
- Ensure all MongoDB fields match types in `lib/types.ts`
- Use optional chaining (`?.`) for fields that might be undefined

### Data Not Updating
- Check API route returns fresh data (not cached)
- Verify `export const dynamic = 'force-dynamic'` in route files
- Check browser console for fetch errors
- Confirm MongoDB collections have recent data

## Documentation

For detailed technical documentation:
- **[CLAUDE.md](CLAUDE.md)** - Developer documentation and implementation patterns
- **[PRODUCTION_READINESS.md](PRODUCTION_READINESS.md)** - Complete deployment checklist and verification steps

## License

MIT

---

**Built with ❤️ for maritime IoT monitoring**
**Last Updated:** January 20, 2026
**Version:** 1.0.0
