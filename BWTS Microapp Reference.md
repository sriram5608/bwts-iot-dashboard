# BWTS Microapp Reference

**URL**: `https://ballast-water-treatment-system-fcfh--wh5fdy5b.apps.onesea.in/?x-vercel-protection-bypass=cSdIr99NLD1sa6E31Ry3psUMdJt1DsVP&x-vercel-set-bypass-cookie=samesitenone`
**API Base**: `https://ballast-water-treatment-system-fcfh--wh5fdy5b.apps.onesea.in`

## Controls

- **Tab buttons**: Rounded pill buttons in fixed nav at top center — Overview, Predictive, Trends, Compliance, Comparative, Export.
- **Comparative tab**: Has lamp selector dropdowns to compare two lamps.
- **Trends tab**: Has date range selector + lamp selector for time series charts.
- **Export tab**: Has date range, column selector toggles, CSV/PDF export buttons, data preview table.
- **No vessel/year selector** — this microapp monitors a single BWTS unit (ONESEA Star).

## CSS Selectors

### Navigation

| Element | CSS Selector | Type | Notes |
|---------|-------------|------|-------|
| Tab nav container | `nav.fixed.top-6` | `<nav>` | Fixed centered, contains pill bar |
| Tab pill bar | `nav.fixed div.flex.items-center.gap-1` | `<div>` | `bg-white/80 backdrop-blur-sm border rounded-full` |
| Active tab button | `button.bg-slate-800.text-white.shadow-md` | `<button>` | Class: `px-4 py-2 rounded-full text-xs font-medium` |
| Inactive tab button | `button.text-slate-600` | `<button>` | Same base class, adds `hover:text-slate-900 hover:bg-slate-100` |

### Overview Tab — HUD Layout (all fixed position)

| Element | CSS Selector | Notes |
|---------|-------------|-------|
| UV Lamp Array (center) | `div.fixed.z-10[class*="top-1/2"][class*="left-1/2"]` | Central element, contains 16 lamp circles |
| Active Alarms (top-left) | `div.fixed.top-24.left-8` | Shows alarm list or "No active alarms" |
| Last Updated (top-center) | `div.fixed.top-24[class*="left-1/2"]` | Timestamp of latest data |
| System Health (top-right) | `div.fixed.top-24.right-8` | Overall score % + gauge |
| Left Metrics (mid-left) | `div.fixed.left-8[class*="top-[55%]"]` | UV Intensity, Power Output, Flow Rate |
| Right Info (mid-right) | `div.fixed.right-8[class*="top-[55%]"]` | Operation, Location, Temperature |
| Maintenance Required (bottom-left) | `div.fixed.bottom-8.left-8` | Lamps needing attention |
| System Pressure (bottom-center) | `div.fixed.bottom-8[class*="left-1/2"]` | Pressure reading |
| Filter System (bottom-right) | `div.fixed.bottom-8.right-8` | ΔP, Backflush count, Status |

### Overview — Element Classes

| Element | Class Pattern | Example |
|---------|--------------|---------|
| Section title | `text-slate-400 text-xs font-medium uppercase tracking-wider` | "System Health", "Maintenance Required" |
| Metric label | `text-slate-400 text-[10px] uppercase tracking-wider mb-1` | "UV Intensity", "Power Output" |
| Metric value (large) | `text-3xl font-light text-{color}` | color: purple-600, blue-500, slate-600 |
| Metric value (4xl) | `text-4xl font-light text-{color}` | System Health score |
| Metric unit | `text-slate-400 text-xs` | "W/m²", "m³/h", "Water temp" |
| Value (xl) | `text-xl font-medium text-slate-700` | Operation type, Location |
| Status badge | `text-sm font-medium px-2 py-1 rounded-full text-{color} bg-{color}-50` | Filter "Idle" status |
| Lamp circle | `w-14 h-14 rounded-full flex flex-col items-center justify-center cursor-pointer` | Individual lamp in array |
| Lamp label | `span.text-white.text-xs.font-semibold` | "L1", "L2" |
| Lamp health % | `span.text-white/80.text-[10px]` | "87%", "70%" |
| Maintenance lamp circle | `w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-semibold` | Bottom-left lamp indicators |

### Predictive / Trends / Compliance — Standard Layout

| Element | CSS Selector | Notes |
|---------|-------------|-------|
| Content wrapper | `div.pt-24.px-8.pb-8` | Contains `div.space-y-8` inner |
| Summary cards grid | `div.grid.grid-cols-4.gap-8` | 4 metric cards per tab |
| Card title | `p.text-slate-400.text-\\[10px\\]` | uppercase tracking-wider |
| Card value | `p.text-3xl.font-light` or `p.text-4xl.font-light` | Color varies by metric |
| Card subtitle | `p.text-slate-400.text-xs` | Unit or description |

### Predictive Tab — Table

| Element | CSS Selector | Notes |
|---------|-------------|-------|
| Table | `table` | Single table, no sort/filter icons |
| Table header | `th.text-left.text-slate-400.text-\\[10px\\]` | `uppercase tracking-wider py-4 px-6` |
| Table cell | `td.py-4.px-6` | Some cells add `text-slate-700` or color |
| Status text | `td span` or `td` direct | Color-coded (see badge map) |

### Predictive Status Colors

| Status | CSS Class |
|--------|-----------|
| Critical | `text-sm text-red-500` |
| High | `text-sm text-orange-500` |
| Moderate | `text-sm text-yellow-600` |
| Good | `text-sm text-emerald-600` |

### Compliance Tab

| Element | CSS Class | Notes |
|---------|-----------|-------|
| Compliance item title | `text-slate-700 font-medium` | "IMO D-2 Standard", "USCG Type Approval" |
| Compliance detail | `text-slate-400 text-xs` | "UV: 736.0 W/m² (min: 252)" |
| COMPLIANT badge | `text-sm font-medium text-emerald-600` | Green text |
| PASS badge | `font-medium text-emerald-600` | Treatment effectiveness |
| Audit trail event | `text-slate-700 text-sm truncate` | Event description |
| Audit trail time | `text-slate-400 text-xs` | "Jan 15, 03:30 PM" |
| Audit trail status | `text-xs font-medium text-emerald-600` | "PASS" |

### Trends & Comparative — Interactive Controls

| Element | CSS Selector | Notes |
|---------|-------------|-------|
| Date input | `input[type="date"]` | Class: `bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-sm` |
| Lamp selector dropdown | `select.bg-white\\/50.border.border-slate-200.rounded-lg` | 16 options (Lamp 1–16), value = lamp number |
| Analysis period label | `p.text-slate-700.text-lg.font-medium` | Shows formatted date range |

### Export Tab

| Element | CSS Selector | Notes |
|---------|-------------|-------|
| Export CSV button | `button[class*="from-emerald-500"]` | Green gradient |
| Export PDF button | `button[class*="from-red-500"]` | Red gradient |
| Column toggle (active) | `button.bg-slate-800.text-white` | `px-3 py-1.5 rounded-full text-xs font-medium` |
| Column toggle (inactive) | `button.bg-white\\/50.text-slate-600` | Same base, different colors |
| Page size select | `select` (in Export tab) | Options: 25, 50, 100 per page |
| Loading indicator | `div.fixed.bottom-4.right-4` | "Loading detailed data... N%" |

## Column Index Maps

### Predictive — Component Predictions Table

| Col | Header | Notes |
|-----|--------|-------|
| 0 | Component | LAMP-01 through LAMP-16 |
| 1 | RUL (hours) | Remaining useful life |
| 2 | Failure Risk | Percentage, color-coded |
| 3 | Efficiency | Percentage |
| 4 | Status | Critical / High / Moderate / Good |

### Export — Data Preview Table (default columns)

| Col | Header | Notes |
|-----|--------|-------|
| 0 | timestamp | ISO date |
| 1 | operation type | BALLAST / DEBALLAST |
| 2 | location | Port name |
| 3 | UVR INTENSITY | W/m² |
| 4 | UVR POWER OUTPUT | % |
| 5 | SYS FLOW RATE | m³/h |
| 6 | SYS PRESSURE | bar |
| 7 | AVG LAMP EFFICIENCY | % |
| 8 | FAILED LAMP COUNT | integer |

## Tabs

| Tab | What's On It |
|-----|--------------|
| Overview | HUD layout: UV Lamp Array center (16 lamps L1-L16 with health %), Active Alarms (top-left), Last Updated (top-center), System Health gauge (top-right), UV Intensity + Power Output + Flow Rate (left), Operation + Location + Temperature (right), Maintenance Required (bottom-left), System Pressure (bottom-center), Filter System (bottom-right) |
| Predictive | Summary cards (Next Maintenance days, At Risk Components, Est. Savings, Avg RUL hours), Component Predictions table (16 rows, 5 cols), Upcoming Maintenance list, Cost Comparison |
| Trends | Analysis Period date range, summary cards (Health Trend %, Avg Efficiency %, Avg UV Intensity, Data Points), System Health Evolution chart, UV Intensity Over Time chart, Lamp Efficiency Heatmap, Lamp Efficiency & Power vs Runtime (lamp selector), Lamp Efficiency vs UV Intensity (lamp selector) |
| Compliance | Summary cards (Compliance Rate %, Active Certifications, Latest Check, Issues), Compliance Status list (5 items: IMO D-2, USCG, Treatment, Maintenance, Certification), Treatment Effectiveness checks, Audit Trail |
| Comparative | Summary (Total Lamps, Data Points, Time Period, Date Range), Lamp Efficiency Comparison chart with two lamp selector dropdowns |
| Export | Summary cards (Total Records, Filtered Records, Date Range, Format), date range inputs, Export CSV/PDF buttons, column selector toggles, data preview table with pagination |

## Question Routing (Parallel Show + Tell)

| Question | Browser (visual) | Data Source | Tier |
|----------|-------------------|-------------|------|
| System health? | Navigate to Overview | API: `GET /api/stats` → `.latestHealth.overall_score` | Direct |
| Risk level? | Overview | API: `GET /api/stats` → `.latestHealth.risk_level` | Direct |
| UV intensity? | Overview | API: `GET /api/stats` → `.latestTelemetry.UVR_INTENSITY` | Direct |
| Power output? | Overview | API: `GET /api/stats` → `.latestTelemetry.UVR_POWER_OUTPUT` | Direct |
| Flow rate? | Overview | API: `GET /api/stats` → `.latestTelemetry.SYS_FLOW_RATE` | Direct |
| Temperature? | Overview | API: `GET /api/stats` → `.latestTelemetry.UVR_WATER_TEMP` | Direct |
| System pressure? | Overview | API: `GET /api/stats` → `.latestTelemetry.SYS_PRESSURE` | Direct |
| Filter status? | Overview | API: `GET /api/stats` → `.latestTelemetry.FLT_MOTOR_STATUS`, `.FLT_DIFF_PRESSURE` | Direct |
| Which lamps need maintenance? | Overview | API: `GET /api/stats` → check `LAMP_{n}_EFFICIENCY` < 70 | Direct |
| Avg lamp efficiency? | Overview | API: `GET /api/stats` → `.latestTelemetry.AVG_LAMP_EFFICIENCY` | Direct |
| Individual lamp status? | Overview | API: `GET /api/stats` → `.latestTelemetry.LAMP_{n}_STATUS/POWER/RUNTIME/EFFICIENCY` | Direct |
| Lamp failure risk? | Click Predictive tab | API: `GET /api/predictions?limit=100` | Direct |
| Remaining useful life? | Predictive tab | API: `GET /api/predictions?limit=100` → `.predictions.remaining_useful_life_hours` | Direct |
| At-risk components? | Predictive tab | API: `GET /api/predictions?limit=100` → filter by `.failure_probability` | Direct |
| Next maintenance due? | Predictive tab | API: `GET /api/predictions?limit=100` → sort by `.remaining_useful_life_hours` | Direct |
| UV health score? | Overview or Trends | API: `GET /api/stats` → `.latestHealth.components.uv_health` | Direct |
| Lamp health score? | Overview | API: `GET /api/stats` → `.latestHealth.components.lamp_health` | Direct |
| Thermal health? | Overview | API: `GET /api/stats` → `.latestHealth.components.thermal_health` | Direct |
| Power efficiency? | Overview | API: `GET /api/stats` → `.latestHealth.components.power_efficiency` | Direct |
| Monthly averages? | Trends tab | API: `GET /api/stats` → `.monthlyAvg` | Direct |
| Compliance status? | Click Compliance tab | Browser: DOM read (compliance items are UI-rendered) | Browser |
| Compare lamp performance? | Click Comparative tab | Browser: select lamps in dropdowns | Browser |
| Health trend chart? | Click Trends tab | Browser: screenshot (chart is visual) | Browser |
| Historical telemetry? | Trends tab | API: `GET /api/telemetry/chunked` → save to file | jq/Python |
| Operation type breakdown? | Export tab | Telemetry file → jq group_by | jq |
| Avg UV intensity over period? | Trends tab | Telemetry file → Python | Python |
| Operation type? | Any tab | API: `GET /api/stats` → `.latestTelemetry.operation_type` | Direct |
| Location? | Overview | API: `GET /api/stats` → `.latestTelemetry.location` | Direct |
| Water quality? | Overview | API: `GET /api/stats` → `.latestTelemetry.WATER_QUALITY` | Direct |
| Compliance mode? | Overview | API: `GET /api/stats` → `.latestTelemetry.COMPLIANCE_MODE` | Direct |

## API Endpoints

### `GET /api/stats`
**Params**: None
**Size**: ~2.9 KB | **Tier**: Direct
**Response**:
```
{
  latestTelemetry: {
    timestamp, system_id, operation_type, location, month,
    UVR_INTENSITY, UVR_INTENSITY_NORMALIZED, UVR_POWER_OUTPUT, UVR_POWER_SETPOINT,
    UVR_WATER_TEMP, UVR_LEVEL,
    LDC_AIR_TEMP, LDC_FAN_SPEED, LDC_FAN_STATUS, LDC_WATER_ALARM,
    FLT_DIFF_PRESSURE, FLT_MOTOR_STATUS, FLT_BACKFLUSH_ACTIVE, FLT_BACKFLUSH_COUNT,
    SYS_FLOW_RATE, SYS_PRESSURE, SYS_VALVE_POSITION,
    SYS_TOTAL_BALLAST_VOL, SYS_TOTAL_DEBALLAST_VOL, SYS_EXTERNAL_FEED,
    CIP_HOURS_SINCE_LAST,
    PLC_CPU_USAGE, PLC_RAM_USAGE, PLC_CPU_TEMP,
    PROCESS_STATE, COMPLIANCE_MODE, WATER_QUALITY, WATER_QUALITY_FACTOR,
    AVG_LAMP_EFFICIENCY, FAILED_LAMP_COUNT, DEGRADATION_IMPACT_PCT, POWER_COMPENSATION_PCT,
    LAMP_{01-16}_STATUS, LAMP_{01-16}_POWER, LAMP_{01-16}_RUNTIME, LAMP_{01-16}_EFFICIENCY
  },
  latestHealth: {
    timestamp, overall_score, risk_level, month,
    components: { uv_health, power_efficiency, lamp_health, thermal_health }
  },
  recentEvents: [],
  monthlyAvg: { avgUVIntensity, avgPowerOutput, avgFlowRate }
}
```
**Use for**: Most questions — system health, lamp status, sensor readings, health scores, monthly averages. This single endpoint answers 80%+ of BWTS questions.

### `GET /api/predictions`
**Params**: `limit` (number, default 100)
**Size**: ~5.1 KB (16 items) | **Tier**: Direct
**Response**: Array of component predictions:
```
[{
  timestamp, component_id, component_type,
  predictions: { remaining_useful_life_hours, failure_probability, efficiency_percent },
  current_state: { runtime_hours, efficiency_percent, status }
}]
```
Components: LAMP-01 through LAMP-16 (type: UV_LAMP).
**Use for**: Predictive tab — failure risk, remaining useful life, component health predictions.

### `GET /api/telemetry/chunked`
**Params**: `startDate` (ISO string), `endDate` (ISO string), `offset` (number), `limit` (number, max 500)
**Size**: ~1.2 MB per 500 rows, ~17,531 total rows | **Tier**: File-based (jq/Python)
**Response**:
```
{
  data: [{ timestamp, system_id, operation_type, location, month, UVR_INTENSITY, ... (102 fields) }],
  pagination: { offset, limit, total, hasMore }
}
```
**Use for**: Historical time series data. Large dataset — NEVER load full response into context. Save to file and process with jq/Python.

## Data Retrieval Patterns

### Endpoint → Tier Mapping

| Endpoint | Typical Size | Tier |
|----------|-------------|------|
| `/api/stats` | 2.9 KB (1 object) | Direct API |
| `/api/predictions?limit=100` | 5.1 KB (16 items) | Direct API |
| `/api/telemetry/chunked` | 1.2 MB per 500 rows | File-based (jq/Python) |

### Curl Fetch Commands

**Stats (Direct — response can go into context):**
```bash
curl -s "https://ballast-water-treatment-system.apps.onesea.in/api/stats" \
  -H "Cookie: x-vercel-protection-bypass=dsfBfXagK0cB0kON67ZxBJkL9CPp61HM"
```

**Predictions (Direct):**
```bash
curl -s "https://ballast-water-treatment-system.apps.onesea.in/api/predictions?limit=100" \
  -H "Cookie: x-vercel-protection-bypass=dsfBfXagK0cB0kON67ZxBJkL9CPp61HM"
```

**Telemetry (File-based — save to /tmp, process with jq/Python):**
```bash
mkdir -p /tmp/bwts-data && curl -s \
  "https://ballast-water-treatment-system.apps.onesea.in/api/telemetry/chunked?startDate={START_ISO}&endDate={END_ISO}&offset=0&limit=500" \
  -H "Cookie: x-vercel-protection-bypass=dsfBfXagK0cB0kON67ZxBJkL9CPp61HM" \
  -o /tmp/bwts-data/telemetry.json
```

### Pre-defined jq Queries

**On `/api/stats` (inline):**
```bash
# Key metrics summary
curl -s ... | jq '{health: .latestHealth.overall_score, risk: .latestHealth.risk_level, uv: .latestTelemetry.UVR_INTENSITY, flow: .latestTelemetry.SYS_FLOW_RATE, avg_eff: .latestTelemetry.AVG_LAMP_EFFICIENCY, failed: .latestTelemetry.FAILED_LAMP_COUNT}'

# All lamp efficiencies
curl -s ... | jq '[range(1;17) as $i | {lamp: $i, eff: .latestTelemetry["LAMP_\(if $i < 10 then "0\($i)" else "\($i)" end)_EFFICIENCY"]}]'

# Health component scores
curl -s ... | jq '.latestHealth.components'

# Monthly averages
curl -s ... | jq '.monthlyAvg'
```

**On `/api/predictions` (inline):**
```bash
# Top 3 at-risk components (sorted by RUL ascending)
curl -s ... | jq '[.[] | {component: .component_id, rul: .predictions.remaining_useful_life_hours, risk: .predictions.failure_probability, eff: .predictions.efficiency_percent}] | sort_by(.rul) | .[0:3]'

# Components with high failure risk (>0.3)
curl -s ... | jq '[.[] | select(.predictions.failure_probability > 0.3) | {id: .component_id, risk: .predictions.failure_probability, rul: .predictions.remaining_useful_life_hours}]'

# Average RUL across all lamps
curl -s ... | jq '[.[].predictions.remaining_useful_life_hours] | add / length | round'
```

**On `/tmp/bwts-data/telemetry.json` (file-based):**
```bash
# Total records
jq '.pagination.total' /tmp/bwts-data/telemetry.json

# Operation type breakdown
jq '[.data[] | .operation_type] | group_by(.) | map({type: .[0], count: length})' /tmp/bwts-data/telemetry.json

# Location breakdown
jq '[.data[] | .location] | group_by(.) | map({location: .[0], count: length}) | sort_by(-.count)' /tmp/bwts-data/telemetry.json

# Avg UV intensity in dataset
jq '[.data[] | .UVR_INTENSITY] | add / length | . * 10 | round / 10' /tmp/bwts-data/telemetry.json

# Records with low lamp efficiency (<70%)
jq '[.data[] | select(.AVG_LAMP_EFFICIENCY < 70)] | length' /tmp/bwts-data/telemetry.json
```

### Ad-hoc Python Workflow

For complex questions on telemetry data:

1. **Read schema sample**: `Read` file with `limit: 5` to see field names
2. **Write Python script** to `/tmp/bwts-data/query.py`
3. **Run**: `python3 /tmp/bwts-data/query.py` — only stdout enters context

**Example — UV intensity trend by day:**
```python
import json
from collections import defaultdict

with open('/tmp/bwts-data/telemetry.json') as f:
    data = json.load(f)

daily = defaultdict(list)
for r in data['data']:
    day = r['timestamp'][:10]
    daily[day].append(r['UVR_INTENSITY'])

print("Date        | Avg UV Intensity | Records")
print("-" * 45)
for day in sorted(daily.keys()):
    vals = daily[day]
    avg = sum(vals) / len(vals)
    print(f"{day} | {avg:>16.1f} | {len(vals)}")
```

**Telemetry schema reference** (102 fields per record):
```
timestamp, system_id, operation_type, location, month,
UVR_INTENSITY, UVR_INTENSITY_NORMALIZED, UVR_POWER_OUTPUT, UVR_POWER_SETPOINT,
UVR_WATER_TEMP, UVR_LEVEL,
LDC_AIR_TEMP, LDC_FAN_SPEED, LDC_FAN_STATUS, LDC_WATER_ALARM,
FLT_DIFF_PRESSURE, FLT_MOTOR_STATUS, FLT_BACKFLUSH_ACTIVE, FLT_BACKFLUSH_COUNT,
SYS_FLOW_RATE, SYS_PRESSURE, SYS_VALVE_POSITION,
SYS_TOTAL_BALLAST_VOL, SYS_TOTAL_DEBALLAST_VOL, SYS_EXTERNAL_FEED,
CIP_HOURS_SINCE_LAST,
PLC_CPU_USAGE, PLC_RAM_USAGE, PLC_CPU_TEMP,
PROCESS_STATE, COMPLIANCE_MODE, WATER_QUALITY, WATER_QUALITY_FACTOR,
AVG_LAMP_EFFICIENCY, FAILED_LAMP_COUNT, DEGRADATION_IMPACT_PCT, POWER_COMPENSATION_PCT,
LAMP_{01-16}_STATUS, LAMP_{01-16}_POWER, LAMP_{01-16}_RUNTIME, LAMP_{01-16}_EFFICIENCY
```

## JS Snippets

### `read_dom_state` — Get active tab and key metrics from any tab

```js
(() => {
  const activeBtn = document.querySelector('nav.fixed button.bg-slate-800');
  const tabName = activeBtn?.textContent?.trim();
  // Try to read summary cards (present on Predictive, Trends, Compliance, Comparative, Export)
  const cards = Array.from(document.querySelectorAll('div.pt-24 p.text-3xl, div.pt-24 p.text-4xl')).map(el => {
    const label = el.previousElementSibling?.textContent?.trim();
    const unit = el.nextElementSibling?.textContent?.trim();
    return label ? { label, value: el.textContent.trim(), unit } : null;
  }).filter(Boolean);
  // Overview HUD metrics (fixed position)
  const healthEl = document.querySelector('div.fixed.top-24.right-8 p.text-4xl');
  const health = healthEl?.textContent?.trim();
  return JSON.stringify({ activeTab: tabName, cards, systemHealth: health || null });
})()
```

### `read_overview_metrics` — Extract all Overview HUD data

Uses `innerText` split by newlines (not leaf-node filter) to capture composite values like `69.6%`.

```js
(() => {
  const get = (sel) => {
    const div = document.querySelector(sel);
    if (!div) return null;
    return div.innerText.split('\n').map(s => s.trim()).filter(t => t.length > 0 && t.length < 80);
  };
  return JSON.stringify({
    alarms: get('div.fixed.top-24.left-8'),
    lastUpdated: get('div.fixed.top-24[class*="left-1/2"]'),
    systemHealth: get('div.fixed.top-24.right-8'),
    leftMetrics: get('div.fixed.left-8[class*="top-[55%]"]'),
    rightInfo: get('div.fixed.right-8[class*="top-[55%]"]'),
    maintenance: get('div.fixed.bottom-8.left-8'),
    pressure: get('div.fixed.bottom-8[class*="left-1/2"]'),
    filterSystem: get('div.fixed.bottom-8.right-8')
  });
})()
```

### `read_lamp_array` — Extract lamp health data from Overview

```js
(() => {
  const lampContainer = document.querySelector('div.fixed.z-10');
  if (!lampContainer) return JSON.stringify({ error: 'Not on Overview tab' });
  const circles = Array.from(lampContainer.querySelectorAll('div.w-14.h-14.rounded-full'));
  const lamps = circles.map(c => {
    const label = c.querySelector('span.text-white.text-xs')?.textContent?.trim();
    const health = c.querySelector('span[class*="text-white/80"]')?.textContent?.trim();
    return label ? { lamp: label, health } : null;
  }).filter(Boolean);
  return JSON.stringify({ lamps, count: lamps.length });
})()
```

### `read_predictions_table` — Extract predictions table from Predictive tab

```js
(() => {
  const table = document.querySelector('table');
  if (!table) return JSON.stringify({ error: 'No table found — switch to Predictive tab' });
  const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
  const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
    Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
  );
  return JSON.stringify({ headers, rows, rowCount: rows.length });
})()
```

### `read_compliance` — Extract compliance items from Compliance tab

Status is in `div.text-right` sibling at the row level (`div.flex.items-center.justify-between`).

```js
(() => {
  const sections = document.querySelectorAll('div.pt-24 div.space-y-8 > div');
  if (sections.length < 2) return JSON.stringify({ error: 'Not on Compliance tab' });
  // Summary cards
  const cards = Array.from(sections[0].querySelectorAll(':scope > div')).map(card => {
    const els = Array.from(card.querySelectorAll('p')).map(p => p.textContent.trim());
    return els.length >= 2 ? { label: els[0], value: els[1], subtitle: els[2] } : null;
  }).filter(Boolean);
  // Compliance items — status in div.text-right at row level
  const rows = Array.from(sections[1].querySelectorAll('div.flex.items-center.justify-between'));
  const items = rows.map(row => {
    const name = row.querySelector('p.text-slate-700.font-medium')?.textContent?.trim();
    const detail = row.querySelector('p.text-slate-400')?.textContent?.trim();
    const statusDiv = row.querySelector('div.text-right');
    const statusLines = statusDiv?.innerText?.split('\n').map(s => s.trim()).filter(Boolean);
    return name ? { name, detail, status: statusLines?.[0], lastCheck: statusLines?.[1] } : null;
  }).filter(Boolean);
  return JSON.stringify({ cards, items });
})()
```

### `switch_tab` — Click a tab by name

```js
((tabName) => {
  const buttons = Array.from(document.querySelectorAll('nav.fixed button'));
  const target = buttons.find(b => b.textContent.trim().toLowerCase().includes(tabName.toLowerCase()));
  if (target) { target.click(); return JSON.stringify({ success: true, switchedTo: target.textContent.trim() }); }
  return JSON.stringify({ success: false, available: buttons.map(b => b.textContent.trim()) });
})("{TAB_NAME}")
```

### `set_date_range` — Set date range on Trends/Export tab (React-compatible)

```js
(async (startDate, endDate) => {
  const inputs = document.querySelectorAll('div.pt-24 input[type="date"]');
  if (inputs.length < 2) return JSON.stringify({ error: 'No date inputs — switch to Trends or Export tab' });
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(inputs[0], startDate);
  inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
  inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
  setter.call(inputs[1], endDate);
  inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
  inputs[1].dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 1500));
  return JSON.stringify({ success: true, startDate, endDate });
})("{START_DATE}", "{END_DATE}")
```

### `select_lamp` — Change lamp selector dropdown on Trends/Comparative tab

```js
((lampNumber, selectorIndex = 0) => {
  const selects = document.querySelectorAll('div.pt-24 select');
  if (selects.length === 0) return JSON.stringify({ error: 'No selects — switch to Trends or Comparative tab' });
  const sel = selects[selectorIndex];
  if (!sel) return JSON.stringify({ error: `Only ${selects.length} selects found` });
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  setter.call(sel, String(lampNumber));
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return JSON.stringify({ success: true, lamp: lampNumber, selector: selectorIndex });
})({LAMP_NUMBER}, {SELECTOR_INDEX})
```

## Fast Operation Sequences

### "What's the current system health?" — 1 call
1. `curl /api/stats | jq '{health: .latestHealth.overall_score, risk: .latestHealth.risk_level, components: .latestHealth.components}'`

### "Show me the Overview" — 2 calls
1. `switch_tab("Overview")`
2. `read_overview_metrics()`

### "Which lamps need attention?" — 1 call
1. `curl /api/predictions | jq '[.[] | select(.predictions.failure_probability > 0.3) | {id: .component_id, risk: .predictions.failure_probability, rul: .predictions.remaining_useful_life_hours}]'`

### "Show lamp predictions table" — 2 calls
1. `switch_tab("Predictive")`
2. `read_predictions_table()`

### "What's the compliance status?" — 2 calls
1. `switch_tab("Compliance")`
2. `read_compliance()`

### "Show health trends for last 30 days" — 3 calls
1. `switch_tab("Trends")`
2. `set_date_range("2025-12-15", "2026-01-15")`
3. Screenshot for chart visual

### "Compare Lamp 3 vs Lamp 7" — 3 calls
1. `switch_tab("Comparative")`
2. `select_lamp(3, 0)` — first selector
3. `select_lamp(7, 1)` — second selector

### "UV intensity trend by day over last month" — 3 calls
1. `curl telemetry → /tmp/bwts-data/telemetry.json`
2. Write Python script to `/tmp/bwts-data/query.py`
3. `python3 /tmp/bwts-data/query.py`

## Known Limitations

1. **Overview tab uses HUD layout** — No standard cards/tables. All metrics are in fixed-position divs scattered around the screen. Use `read_overview_metrics()` to extract them all at once.
2. **Predictive table has no sort/filter** — The Component Predictions table has no column filter icons or sort buttons. Data must be filtered via the API (`/api/predictions`) or jq.
3. **Charts are visual-only** — System Health Evolution, UV Intensity Over Time, Lamp Efficiency charts on Trends/Comparative tabs are Recharts SVG. Use screenshot for visual; use API/telemetry data for numerical analysis.
4. **Telemetry is large** — 17,531+ records, ~1.2 MB per 500-row chunk. Never load full response into context. Always save to file and use jq/Python.
5. **Export tab loads async** — Shows "Loading detailed data... N%" progress. Wait for completion before interacting.
6. **Date range on Trends needs React setter** — Standard `input.value = x` doesn't work. Use `set_date_range` snippet with prototype setter + change event.
7. **Compliance items are UI-rendered** — Compliance details (IMO D-2, USCG, etc.) are computed and rendered in the frontend. No single API returns them as structured data. Use `read_compliance()` snippet to extract from DOM.
8. **Tab content loads async after switch** — After `switch_tab()`, wait ~2s before querying elements on Comparative/Export tabs. Date inputs and selects may not be in the DOM yet.
9. **CDP IIFE return** — When using `chrome_javascript` (chrome-mcp-server), snippets need `return` prefix before the IIFE (e.g., `return (() => { ... })()`). The tool wraps code in an async function body, so bare IIFE return values are lost.
