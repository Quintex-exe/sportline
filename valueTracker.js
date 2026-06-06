// ── FOOTINT VALUE TRACKER ──────────────────────────────────────────────────────
// Real-time player market valuation tracker
// Integrates live player values with transfer intelligence
// Data sources: Transfermarkt, StatsBomb, Sofascore APIs
// Features: Value trending, transfer alerts, valuation confidence, market analysis

// ── VALUE API CONNECTORS ────────────────────────────────────────────────────
class ValueAPI {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 300000; // 5 minutes
    this.rateLimit = { calls: 0, resetTime: Date.now() };
  }

  // ── Rate limiter (respect API quotas) ───────────────────────────────────────
  async rateLimitCheck(maxCallsPerMinute = 60) {
    const now = Date.now();
    if (now > this.rateLimit.resetTime) {
      this.rateLimit = { calls: 0, resetTime: now + 60000 };
    }
    if (this.rateLimit.calls >= maxCallsPerMinute) {
      const waitTime = this.rateLimit.resetTime - now;
      console.warn(`Rate limit hit. Waiting ${waitTime}ms`);
      await new Promise(r => setTimeout(r, waitTime));
      this.rateLimit = { calls: 0, resetTime: Date.now() + 60000 };
    }
    this.rateLimit.calls++;
  }

  // ── Cache helper ────────────────────────────────────────────────────────────
  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    return null;
  }

  setCached(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // ── Transfermarkt API (player market values) ────────────────────────────────
  // Note: Transfermarkt API requires unofficial endpoint or web scraping
  // This is a placeholder for when official API becomes available
  async getTransfermarktValue(playerName, playerTeam) {
    const cacheKey = `tm_${playerName}_${playerTeam}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    await this.rateLimitCheck();
    
    try {
      // Replace with actual Transfermarkt API endpoint when available
      // Currently returns structured mock data
      const mockData = {
        player: playerName,
        team: playerTeam,
        marketValue: this.generateMockValue(playerName),
        currency: 'EUR',
        age: this.getAgeFromDB(playerName),
        position: this.getPositionFromDB(playerName),
        contract_until: this.getContractEndDate(playerName),
        last_updated: new Date().toISOString()
      };

      this.setCached(cacheKey, mockData);
      return mockData;
    } catch (error) {
      console.error(`Transfermarkt fetch error for ${playerName}:`, error);
      return null;
    }
  }

  // ── StatsBomb API (performance metrics influencing value) ────────────────────
  async getPlayerPerformanceMetrics(playerName, season = '2025-26') {
    const cacheKey = `sb_${playerName}_${season}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    await this.rateLimitCheck();

    try {
      // StatsBomb free tier: limited historical data
      const mockMetrics = {
        player: playerName,
        season,
        appearances: Math.floor(Math.random() * 30) + 5,
        goals: Math.floor(Math.random() * 20),
        assists: Math.floor(Math.random() * 10),
        pass_accuracy: (Math.random() * 20 + 80).toFixed(1),
        tackles: Math.floor(Math.random() * 50),
        interceptions: Math.floor(Math.random() * 30),
        key_passes: Math.floor(Math.random() * 40),
        form_rating: (Math.random() * 3 + 6.5).toFixed(1), // 6.5-9.5
      };

      this.setCached(cacheKey, mockMetrics);
      return mockMetrics;
    } catch (error) {
      console.error(`StatsBomb fetch error for ${playerName}:`, error);
      return null;
    }
  }

  // ── Sofascore API (live form & recent activity) ──────────────────────────────
  async getLiveFormData(playerName) {
    const cacheKey = `sf_${playerName}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    await this.rateLimitCheck();

    try {
      const mockForm = {
        player: playerName,
        last_5_matches: this.generateLastFiveRatings(),
        form_trend: Math.random() > 0.5 ? 'ascending' : 'descending',
        minutes_played_recent: Math.floor(Math.random() * 450),
        injury_status: Math.random() > 0.9 ? 'doubtful' : 'fit',
        updated_at: new Date().toISOString()
      };

      this.setCached(cacheKey, mockForm);
      return mockForm;
    } catch (error) {
      console.error(`Sofascore fetch error for ${playerName}:`, error);
      return null;
    }
  }

  // ── Helper: Mock data generation (replace with real API) ────────────────────
  generateMockValue(playerName) {
    const hash = playerName.split('').reduce((h, c) => h + c.charCodeAt(0), 0);
    const baseValue = (hash % 80) + 10; // 10M - 90M EUR
    return baseValue * 1000000;
  }

  getAgeFromDB(playerName) {
    return Math.floor(Math.random() * 20) + 18; // 18-38 years
  }

  getPositionFromDB(playerName) {
    const positions = ['Striker', 'Midfielder', 'Defender', 'Goalkeeper', 'Winger'];
    return positions[Math.floor(Math.random() * positions.length)];
  }

  getContractEndDate(playerName) {
    const years = Math.floor(Math.random() * 5) + 1;
    const date = new Date();
    date.setFullYear(date.getFullYear() + years);
    return date.toISOString().split('T')[0];
  }

  generateLastFiveRatings() {
    return Array(5).fill(0).map(() => (Math.random() * 3 + 6).toFixed(1));
  }
}

// ── VALUATION ENGINE ─────────────────────────────────────────────────────────
class ValuationEngine {
  constructor() {
    this.valueAPI = new ValueAPI();
    this.valuationHistory = new Map(); // Track value changes over time
  }

  // ── Calculate composite value score ──────────────────────────────────────────
  async calculatePlayerValue(playerName, playerTeam) {
    try {
      const [marketData, performance, formData] = await Promise.all([
        this.valueAPI.getTransfermarktValue(playerName, playerTeam),
        this.valueAPI.getPlayerPerformanceMetrics(playerName),
        this.valueAPI.getLiveFormData(playerName)
      ]);

      if (!marketData) return null;

      // Value multipliers based on performance
      let multiplier = 1.0;

      if (performance) {
        // Form factor (6.5-9.5 rating)
        const formFactor = (parseFloat(performance.form_rating) - 6.5) / 3;
        multiplier += formFactor * 0.15; // ±15% adjustment

        // Appearance factor (playing time)
        const appearances = performance.appearances;
        if (appearances > 20) multiplier += 0.1;
        if (appearances > 25) multiplier += 0.05;
      }

      if (formData) {
        // Recent form trend
        if (formData.form_trend === 'ascending') multiplier += 0.1;
        else multiplier -= 0.05;

        // Injury impact
        if (formData.injury_status === 'doubtful') multiplier -= 0.2;
      }

      const adjustedValue = marketData.marketValue * multiplier;
      const valueChange = adjustedValue - marketData.marketValue;

      const valuation = {
        player: playerName,
        team: playerTeam,
        baseValue: marketData.marketValue,
        adjustedValue: Math.round(adjustedValue),
        valueChange: Math.round(valueChange),
        changePercent: ((valueChange / marketData.marketValue) * 100).toFixed(2),
        multiplier: multiplier.toFixed(2),
        confidence: this.calculateConfidence(performance, formData),
        position: marketData.position,
        age: marketData.age,
        contractUntil: marketData.contract_until,
        metrics: performance,
        formData: formData,
        timestamp: Date.now()
      };

      // Store in history
      this.storeValuationHistory(playerName, valuation);

      return valuation;
    } catch (error) {
      console.error(`Valuation calculation failed for ${playerName}:`, error);
      return null;
    }
  }

  // ── Confidence score based on data completeness ──────────────────────────────
  calculateConfidence(performance, formData) {
    let confidence = 60; // Base confidence

    if (performance) {
      if (performance.appearances > 15) confidence += 15;
      if (performance.pass_accuracy > 80) confidence += 10;
      if (performance.key_passes > 20) confidence += 5;
    }

    if (formData) {
      if (formData.form_trend === 'ascending') confidence += 10;
      if (formData.injury_status === 'fit') confidence += 10;
    }

    return Math.min(confidence, 100); // Cap at 100
  }

  // ── Store valuation in history ───────────────────────────────────────────────
  storeValuationHistory(playerName, valuation) {
    if (!this.valuationHistory.has(playerName)) {
      this.valuationHistory.set(playerName, []);
    }
    this.valuationHistory.get(playerName).push(valuation);

    // Keep last 100 records per player to avoid memory bloat
    const history = this.valuationHistory.get(playerName);
    if (history.length > 100) {
      history.shift();
    }
  }

  // ── Get valuation trend for a player ─────────────────────────────────────────
  getValuationTrend(playerName) {
    const history = this.valuationHistory.get(playerName) || [];
    if (history.length < 2) return { trend: 'neutral', direction: '→' };

    const oldest = history[0].adjustedValue;
    const newest = history[history.length - 1].adjustedValue;
    const change = newest - oldest;

    let trend, direction, icon;
    if (change > oldest * 0.1) {
      trend = 'rising';
      direction = '↑';
      icon = '📈';
    } else if (change < -(oldest * 0.1)) {
      trend = 'falling';
      direction = '↓';
      icon = '📉';
    } else {
      trend = 'stable';
      direction = '→';
      icon = '→';
    }

    return {
      trend,
      direction,
      icon,
      changeAmount: Math.round(change),
      changePercent: ((change / oldest) * 100).toFixed(2),
      records: history.length
    };
  }
}

// ── TRANSFER INTELLIGENCE INTEGRATOR ─────────────────────────────────────────
class TransferValueAnalyzer {
  constructor(valuationEngine) {
    this.valuationEngine = valuationEngine;
  }

  // ── Analyze transfer event with value context ────────────────────────────────
  async analyzeTransferEvent(transferData) {
    // transferData: { type, player, fromClub, toClub, fee, eventType, timestamp }

    try {
      const playerValuation = await this.valuationEngine.calculatePlayerValue(
        transferData.player,
        transferData.toClub
      );

      if (!playerValuation) return null;

      const analysis = {
        transfer: transferData,
        valuation: playerValuation,
        marketRating: this.assessDeal(transferData.fee, playerValuation),
        signals: this.generateSignals(playerValuation, transferData),
        timestamp: Date.now()
      };

      return analysis;
    } catch (error) {
      console.error(`Transfer analysis failed:`, error);
      return null;
    }
  }

  // ── Rate transfer deal value ─────────────────────────────────────────────────
  assessDeal(fee, valuation) {
    const feeRatio = fee / valuation.baseValue;

    if (feeRatio > 1.3) {
      return { rating: 'OVERVALUED', reason: 'Fee exceeds market by 30%+' };
    } else if (feeRatio > 1.1) {
      return { rating: 'PREMIUM', reason: 'Fee 10-30% above market' };
    } else if (feeRatio > 0.9) {
      return { rating: 'FAIR', reason: 'Fee near market value' };
    } else if (feeRatio > 0.7) {
      return { rating: 'BARGAIN', reason: 'Fee 10-30% below market' };
    } else {
      return { rating: 'STEAL', reason: 'Fee significantly below market' };
    }
  }

  // ── Generate trade signals ────────────────────────────────────────────────────
  generateSignals(valuation, transferData) {
    const signals = [];

    // Value trend signal
    const trend = this.valuationEngine.getValuationTrend(transferData.player);
    if (trend.trend === 'rising') {
      signals.push({
        type: 'MOMENTUM',
        severity: 'high',
        message: `Player value rising ${trend.changePercent}% — strong momentum signal`
      });
    }

    // Form-based signal
    if (valuation.formData && valuation.formData.form_trend === 'ascending') {
      signals.push({
        type: 'FORM_POSITIVE',
        severity: 'medium',
        message: 'Recent form improving — value likely to continue rising'
      });
    }

    // Age factor
    if (valuation.age < 24) {
      signals.push({
        type: 'YOUNG_TALENT',
        severity: 'high',
        message: 'Young player with potential for significant future growth'
      });
    } else if (valuation.age > 30) {
      signals.push({
        type: 'VETERAN_RISK',
        severity: 'medium',
        message: 'Veteran age — value may depreciate in future windows'
      });
    }

    // Contract risk
    const contractDate = new Date(valuation.contractUntil);
    const monthsRemaining = (contractDate - new Date()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsRemaining < 18) {
      signals.push({
        type: 'CONTRACT_WARNING',
        severity: 'high',
        message: `Only ${Math.round(monthsRemaining)} months left on contract`
      });
    }

    // Confidence signal
    if (valuation.confidence < 65) {
      signals.push({
        type: 'LOW_DATA_CONFIDENCE',
        severity: 'low',
        message: `Valuation confidence only ${valuation.confidence}% — limited data`
      });
    }

    return signals;
  }
}

// ── VALUE STREAM RENDERER (for UI integration) ──────────────────────────────
class ValueStreamRenderer {
  constructor(valuationEngine, transferAnalyzer) {
    this.valuationEngine = valuationEngine;
    this.transferAnalyzer = transferAnalyzer;
  }

  // ── Generate HTML for value alert ────────────────────────────────────────────
  renderValueAlert(transferAnalysis) {
    if (!transferAnalysis) return '';

    const v = transferAnalysis.valuation;
    const trend = this.valuationEngine.getValuationTrend(transferAnalysis.transfer.player);
    const rating = transferAnalysis.marketRating;

    const changeColor = v.valueChange > 0 ? '#39ff6a' : '#ff6b6b';
    const changeDir = v.valueChange > 0 ? '↑' : '↓';

    let html = `
      <div style="
        background: rgba(3,12,10,0.9);
        border: 1px solid rgba(57,255,106,0.12);
        border-radius: 6px;
        padding: 10px 12px;
        margin-bottom: 8px;
        font-family: 'Share Tech Mono', monospace;
        font-size: 10px;
        color: #d7fff1;
      ">
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <strong>${transferAnalysis.transfer.player}</strong>
          <span style="color: ${changeColor}; font-weight:bold;">
            ${changeDir} ${Math.abs(v.valueChange / 1000000).toFixed(1)}M €
          </span>
        </div>
        
        <div style="color: #7a9e88; font-size:9px; margin-bottom:6px;">
          ${transferAnalysis.transfer.fromClub} → ${transferAnalysis.transfer.toClub}
        </div>

        <div style="background: rgba(255,255,255,0.03); padding:6px; border-radius:3px; margin-bottom:6px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:9px;">
            <div>
              <span style="color: #557566;">BASE VALUE</span><br/>
              ${(v.baseValue / 1000000).toFixed(1)}M €
            </div>
            <div>
              <span style="color: #557566;">ADJUSTED VALUE</span><br/>
              ${(v.adjustedValue / 1000000).toFixed(1)}M €
            </div>
            <div>
              <span style="color: #557566;">CONFIDENCE</span><br/>
              ${v.confidence}%
            </div>
            <div>
              <span style="color: #557566;">DEAL RATING</span><br/>
              <strong style="color: ${this.getRatingColor(rating.rating)};">${rating.rating}</strong>
            </div>
          </div>
        </div>

        <div style="color: #5af5ff; font-size:9px; margin-bottom:6px;">
          Trend: ${trend.icon} ${trend.trend.toUpperCase()} (${trend.changePercent}%)
        </div>

        <div style="border-top: 1px solid rgba(255,255,255,0.03); padding-top:6px;">
          <div style="color: #f9c74f; font-size:8px; font-weight:bold; margin-bottom:3px;">SIGNALS</div>
          ${this.renderSignals(transferAnalysis.signals)}
        </div>
      </div>
    `;

    return html;
  }

  // ── Render individual signals ────────────────────────────────────────────────
  renderSignals(signals) {
    if (!signals || signals.length === 0) {
      return '<div style="color: #445; font-size:8px;">No active signals</div>';
    }

    return signals.slice(0, 3).map(signal => `
      <div style="
        color: ${signal.severity === 'high' ? '#ff6b6b' : '#f9c74f'};
        font-size: 8px;
        margin-bottom: 2px;
      ">
        • ${signal.message}
      </div>
    `).join('');
  }

  getRatingColor(rating) {
    const colors = {
      'STEAL': '#39ff6a',
      'BARGAIN': '#5af5ff',
      'FAIR': '#f9c74f',
      'PREMIUM': '#ff9f6b',
      'OVERVALUED': '#ff6b6b'
    };
    return colors[rating] || '#7a9e88';
  }
}

// ── EXPORT MODULE ──────────────────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ValueAPI,
    ValuationEngine,
    TransferValueAnalyzer,
    ValueStreamRenderer
  };
}

// ── CLIENT-SIDE INITIALIZATION (for browser use) ─────────────────────────────
if (typeof window !== 'undefined') {
  window.footintValueTracker = {
    engine: new ValuationEngine(),
    analyzer: new TransferValueAnalyzer(new ValuationEngine()),
    renderer: null,

    init: function() {
      this.renderer = new ValueStreamRenderer(this.engine, this.analyzer);
      console.log('FOOTINT Value Tracker initialized');
      return this;
    },

    // Public API for feed integration
    analyzeTransfer: async function(transferData) {
      return await this.analyzer.analyzeTransferEvent(transferData);
    },

    getPlayerValue: async function(playerName, team) {
      return await this.engine.calculatePlayerValue(playerName, team);
    },

    renderAlert: function(analysis) {
      return this.renderer.renderValueAlert(analysis);
    }
  };
}
