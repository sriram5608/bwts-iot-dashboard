// Threshold values for BWTS system
export const THRESHOLDS = {
  UV_INTENSITY: {
    USCG_MIN: 530, // W/m²
    IMO_MIN: 252, // W/m²
    OPTIMAL: 650, // W/m²
  },
  LAMP_EFFICIENCY: {
    GOOD: 90, // >= 90%
    WARNING: 70, // 70-89%
    CRITICAL: 50, // < 50%
  },
  LAMP_RUNTIME: {
    MAX: 3000, // hours
    WARNING: 2500, // hours
  },
  HEALTH_SCORE: {
    GOOD: 80,
    WARNING: 60,
    CRITICAL: 40,
  },
}

// Color gradients for glassmorphism cards
export const GRADIENTS = {
  PURPLE: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  BLUE: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  RED: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  ORANGE: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  GREEN: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
}

// Auto-refresh interval (milliseconds)
export const REFRESH_INTERVAL = 30000 // 30 seconds

// Chart colors
export const CHART_COLORS = {
  PRIMARY: '#a78bfa',
  SECONDARY: '#60a5fa',
  SUCCESS: '#34d399',
  WARNING: '#fbbf24',
  DANGER: '#f87171',
}

// Progressive loading configuration
export const LOADING_CONFIG = {
  CHUNK_SIZE: 500, // Records per chunk when streaming raw data
  STREAM_DELAY: 100, // Milliseconds between chunk loads
  MAX_CHART_POINTS: 300, // Downsample charts to this many points for visual clarity
}
