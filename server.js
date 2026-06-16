const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Helper to fetch data via HTTPS (returns Promise)
function fetchHttps(url, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...customHeaders
    };

    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, body: data });
        } else {
          reject(new Error(`Request failed with status ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Kalshi in-memory cache
let kalshiSeriesCache = null;
let kalshiSeriesCacheTime = 0;

// Sector cache
const CACHE_FILE = path.join(__dirname, 'sector_cache.json');
let sectorCache = {};

const SEED_SECTORS = {
  // Tech / Software / Semiconductors
  'MSFT': { sector: 'Technology', industry: 'Software—Infrastructure', etf: 'XLK' },
  'AAPL': { sector: 'Technology', industry: 'Consumer Electronics', etf: 'XLK' },
  'NVDA': { sector: 'Technology', industry: 'Semiconductors', etf: 'XLK' },
  'AVGO': { sector: 'Technology', industry: 'Semiconductors', etf: 'XLK' },
  'CSCO': { sector: 'Technology', industry: 'Communication Equipment', etf: 'XLK' },
  'ADBE': { sector: 'Technology', industry: 'Software—Application', etf: 'XLK' },
  'CRM': { sector: 'Technology', industry: 'Software—Application', etf: 'XLK' },
  'AMD': { sector: 'Technology', industry: 'Semiconductors', etf: 'XLK' },
  'QCOM': { sector: 'Technology', industry: 'Semiconductors', etf: 'XLK' },
  'INTC': { sector: 'Technology', industry: 'Semiconductors', etf: 'XLK' },
  'TXN': { sector: 'Technology', industry: 'Semiconductors', etf: 'XLK' },
  'AMAT': { sector: 'Technology', industry: 'Semiconductor Equipment & Materials', etf: 'XLK' },
  'MU': { sector: 'Technology', industry: 'Semiconductors', etf: 'XLK' },
  'NOW': { sector: 'Technology', industry: 'Software—Application', etf: 'XLK' },
  'PANW': { sector: 'Technology', industry: 'Software—Infrastructure', etf: 'XLK' },
  'SNPS': { sector: 'Technology', industry: 'Software—Infrastructure', etf: 'XLK' },
  'CDNS': { sector: 'Technology', industry: 'Software—Infrastructure', etf: 'XLK' },
  'KLAC': { sector: 'Technology', industry: 'Semiconductor Equipment & Materials', etf: 'XLK' },
  'LRCX': { sector: 'Technology', industry: 'Semiconductor Equipment & Materials', etf: 'XLK' },
  'ACN': { sector: 'Technology', industry: 'Information Technology Services', etf: 'XLK' },
  'IBM': { sector: 'Technology', industry: 'Information Technology Services', etf: 'XLK' },
  'INTU': { sector: 'Technology', industry: 'Software—Application', etf: 'XLK' },
  'ORCL': { sector: 'Technology', industry: 'Software—Infrastructure', etf: 'XLK' },
  'SHOP': { sector: 'Technology', industry: 'Software—Application', etf: 'XLK' },
  'SAP': { sector: 'Technology', industry: 'Software—Application', etf: 'XLK' },
  'ASML': { sector: 'Technology', industry: 'Semiconductor Equipment & Materials', etf: 'XLK' },
  'PLTR': { sector: 'Technology', industry: 'Software—Infrastructure', etf: 'XLK' },
  'WDAY': { sector: 'Technology', industry: 'Software—Application', etf: 'XLK' },
  'SNOW': { sector: 'Technology', industry: 'Software—Application', etf: 'XLK' },
  'DDOG': { sector: 'Technology', industry: 'Software—Application', etf: 'XLK' },
  'NET': { sector: 'Technology', industry: 'Software—Infrastructure', etf: 'XLK' },
  'CRWD': { sector: 'Technology', industry: 'Software—Infrastructure', etf: 'XLK' },
  
  // Communication Services
  'GOOGL': { sector: 'Communication Services', industry: 'Internet Content & Information', etf: 'XLC' },
  'GOOG': { sector: 'Communication Services', industry: 'Internet Content & Information', etf: 'XLC' },
  'META': { sector: 'Communication Services', industry: 'Internet Content & Information', etf: 'XLC' },
  'NFLX': { sector: 'Communication Services', industry: 'Entertainment', etf: 'XLC' },
  'DIS': { sector: 'Communication Services', industry: 'Entertainment', etf: 'XLC' },
  'TMUS': { sector: 'Communication Services', industry: 'Telecom Services', etf: 'XLC' },
  'VZ': { sector: 'Communication Services', industry: 'Telecom Services', etf: 'XLC' },
  'T': { sector: 'Communication Services', industry: 'Telecom Services', etf: 'XLC' },
  'CMCSA': { sector: 'Communication Services', industry: 'Entertainment', etf: 'XLC' },
  'CHTR': { sector: 'Communication Services', industry: 'Entertainment', etf: 'XLC' },
  
  // Consumer Cyclical / Retail / Auto / Travel
  'AMZN': { sector: 'Consumer Cyclical', industry: 'Internet Retail', etf: 'XLY' },
  'TSLA': { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', etf: 'XLY' },
  'HD': { sector: 'Consumer Cyclical', industry: 'Home Improvement Retail', etf: 'XLY' },
  'MCD': { sector: 'Consumer Cyclical', industry: 'Restaurants', etf: 'XLY' },
  'NKE': { sector: 'Consumer Cyclical', industry: 'Footwear & Accessories', etf: 'XLY' },
  'LOW': { sector: 'Consumer Cyclical', industry: 'Home Improvement Retail', etf: 'XLY' },
  'SBUX': { sector: 'Consumer Cyclical', industry: 'Restaurants', etf: 'XLY' },
  'TJX': { sector: 'Consumer Cyclical', industry: 'Apparel Retail', etf: 'XLY' },
  'BKNG': { sector: 'Consumer Cyclical', industry: 'Travel Services', etf: 'XLY' },
  'LULU': { sector: 'Consumer Cyclical', industry: 'Apparel Retail', etf: 'XLY' },
  'PLAY': { sector: 'Consumer Cyclical', industry: 'Restaurants', etf: 'XLY' },
  'DHI': { sector: 'Consumer Cyclical', industry: 'Residential Construction', etf: 'XLY' },
  'LEN': { sector: 'Consumer Cyclical', industry: 'Residential Construction', etf: 'XLY' },
  'F': { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', etf: 'XLY' },
  'GM': { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', etf: 'XLY' },
  'CMG': { sector: 'Consumer Cyclical', industry: 'Restaurants', etf: 'XLY' },
  'ABNB': { sector: 'Consumer Cyclical', industry: 'Travel Services', etf: 'XLY' },
  'MELI': { sector: 'Consumer Cyclical', industry: 'Internet Retail', etf: 'XLY' },
  'EBAY': { sector: 'Consumer Cyclical', industry: 'Internet Retail', etf: 'XLY' },

  // Consumer Defensive / Consumer Staples
  'WMT': { sector: 'Consumer Defensive', industry: 'Discount Stores', etf: 'XLP' },
  'PG': { sector: 'Consumer Defensive', industry: 'Household & Personal Products', etf: 'XLP' },
  'KO': { sector: 'Consumer Defensive', industry: 'Beverages—Non-Alcoholic', etf: 'XLP' },
  'PEP': { sector: 'Consumer Defensive', industry: 'Beverages—Non-Alcoholic', etf: 'XLP' },
  'COST': { sector: 'Consumer Defensive', industry: 'Discount Stores', etf: 'XLP' },
  'PM': { sector: 'Consumer Defensive', industry: 'Tobacco', etf: 'XLP' },
  'EL': { sector: 'Consumer Defensive', industry: 'Household & Personal Products', etf: 'XLP' },
  'MO': { sector: 'Consumer Defensive', industry: 'Tobacco', etf: 'XLP' },
  'CL': { sector: 'Consumer Defensive', industry: 'Household & Personal Products', etf: 'XLP' },
  'KMB': { sector: 'Consumer Defensive', industry: 'Household & Personal Products', etf: 'XLP' },
  'TGT': { sector: 'Consumer Defensive', industry: 'Discount Stores', etf: 'XLP' },
  'DG': { sector: 'Consumer Defensive', industry: 'Discount Stores', etf: 'XLP' },
  'DLTR': { sector: 'Consumer Defensive', industry: 'Discount Stores', etf: 'XLP' },
  'KR': { sector: 'Consumer Defensive', industry: 'Grocery Stores', etf: 'XLP' },
  'GIS': { sector: 'Consumer Defensive', industry: 'Packaged Foods', etf: 'XLP' },
  'K': { sector: 'Consumer Defensive', industry: 'Packaged Foods', etf: 'XLP' },
  'SYY': { sector: 'Consumer Defensive', industry: 'Food Distribution', etf: 'XLP' },
  'ADM': { sector: 'Consumer Defensive', industry: 'Farm Products', etf: 'XLP' },

  // Financial Services
  'JPM': { sector: 'Financial Services', industry: 'Banks—Diversified', etf: 'XLF' },
  'BAC': { sector: 'Financial Services', industry: 'Banks—Diversified', etf: 'XLF' },
  'MS': { sector: 'Financial Services', industry: 'Capital Markets', etf: 'XLF' },
  'GS': { sector: 'Financial Services', industry: 'Capital Markets', etf: 'XLF' },
  'WFC': { sector: 'Financial Services', industry: 'Banks—Diversified', etf: 'XLF' },
  'C': { sector: 'Financial Services', industry: 'Banks—Diversified', etf: 'XLF' },
  'V': { sector: 'Financial Services', industry: 'Credit Services', etf: 'XLF' },
  'MA': { sector: 'Financial Services', industry: 'Credit Services', etf: 'XLF' },
  'PYPL': { sector: 'Financial Services', industry: 'Credit Services', etf: 'XLF' },
  'AXP': { sector: 'Financial Services', industry: 'Credit Services', etf: 'XLF' },
  'BLK': { sector: 'Financial Services', industry: 'Asset Management', etf: 'XLF' },
  'SCHW': { sector: 'Financial Services', industry: 'Capital Markets', etf: 'XLF' },
  'CB': { sector: 'Financial Services', industry: 'Insurance—Property & Casualty', etf: 'XLF' },
  'MMC': { sector: 'Financial Services', industry: 'Insurance Brokers', etf: 'XLF' },
  'PGR': { sector: 'Financial Services', industry: 'Insurance—Property & Casualty', etf: 'XLF' },
  'SPGI': { sector: 'Financial Services', industry: 'Financial Data & Stock Exchanges', etf: 'XLF' },
  'MCO': { sector: 'Financial Services', industry: 'Financial Data & Stock Exchanges', etf: 'XLF' },
  
  // Healthcare
  'LLY': { sector: 'Healthcare', industry: 'Drug Manufacturers—General', etf: 'XLV' },
  'UNH': { sector: 'Healthcare', industry: 'Healthcare Plans', etf: 'XLV' },
  'JNJ': { sector: 'Healthcare', industry: 'Drug Manufacturers—General', etf: 'XLV' },
  'ABBV': { sector: 'Healthcare', industry: 'Drug Manufacturers—General', etf: 'XLV' },
  'MRK': { sector: 'Healthcare', industry: 'Drug Manufacturers—General', etf: 'XLV' },
  'TMO': { sector: 'Healthcare', industry: 'Diagnostics & Research', etf: 'XLV' },
  'ABT': { sector: 'Healthcare', industry: 'Medical Devices', etf: 'XLV' },
  'DHR': { sector: 'Healthcare', industry: 'Diagnostics & Research', etf: 'XLV' },
  'PFE': { sector: 'Healthcare', industry: 'Drug Manufacturers—General', etf: 'XLV' },
  'AMGN': { sector: 'Healthcare', industry: 'Biotechnology', etf: 'XLV' },
  'ISRG': { sector: 'Healthcare', industry: 'Medical Devices', etf: 'XLV' },
  'GILD': { sector: 'Healthcare', industry: 'Biotechnology', etf: 'XLV' },
  'BMY': { sector: 'Healthcare', industry: 'Drug Manufacturers—General', etf: 'XLV' },
  'CVS': { sector: 'Healthcare', industry: 'Healthcare Plans', etf: 'XLV' },
  'CI': { sector: 'Healthcare', industry: 'Healthcare Plans', etf: 'XLV' },
  'ELV': { sector: 'Healthcare', industry: 'Healthcare Plans', etf: 'XLV' },
  'BIIB': { sector: 'Healthcare', industry: 'Biotechnology', etf: 'XLV' },
  'MRNA': { sector: 'Healthcare', industry: 'Biotechnology', etf: 'XLV' },

  // Industrials
  'GE': { sector: 'Industrials', industry: 'Specialty Industrial Machinery', etf: 'XLI' },
  'CAT': { sector: 'Industrials', industry: 'Farm & Heavy Construction Machinery', etf: 'XLI' },
  'HON': { sector: 'Industrials', industry: 'Conglomerates', etf: 'XLI' },
  'UNP': { sector: 'Industrials', industry: 'Railroads', etf: 'XLI' },
  'UPS': { sector: 'Industrials', industry: 'Integrated Freight & Logistics', etf: 'XLI' },
  'LMT': { sector: 'Industrials', industry: 'Aerospace & Defense', etf: 'XLI' },
  'RTX': { sector: 'Industrials', industry: 'Aerospace & Defense', etf: 'XLI' },
  'DE': { sector: 'Industrials', industry: 'Farm & Heavy Construction Machinery', etf: 'XLI' },
  'BA': { sector: 'Industrials', industry: 'Aerospace & Defense', etf: 'XLI' },
  'FDX': { sector: 'Industrials', industry: 'Integrated Freight & Logistics', etf: 'XLI' },
  'WM': { sector: 'Industrials', industry: 'Waste Management', etf: 'XLI' },
  'NSC': { sector: 'Industrials', industry: 'Railroads', etf: 'XLI' },
  'CSX': { sector: 'Industrials', industry: 'Railroads', etf: 'XLI' },

  // Energy
  'XOM': { sector: 'Energy', industry: 'Oil & Gas Integrated', etf: 'XLE' },
  'CVX': { sector: 'Energy', industry: 'Oil & Gas Integrated', etf: 'XLE' },
  'COP': { sector: 'Energy', industry: 'Oil & Gas E&P', etf: 'XLE' },
  'SLB': { sector: 'Energy', industry: 'Oil & Gas Equipment & Services', etf: 'XLE' },
  'EOG': { sector: 'Energy', industry: 'Oil & Gas E&P', etf: 'XLE' },
  'MPC': { sector: 'Energy', industry: 'Oil & Gas Refining & Marketing', etf: 'XLE' },
  'PSX': { sector: 'Energy', industry: 'Oil & Gas Refining & Marketing', etf: 'XLE' },
  'VLO': { sector: 'Energy', industry: 'Oil & Gas Refining & Marketing', etf: 'XLE' },
  'OXY': { sector: 'Energy', industry: 'Oil & Gas E&P', etf: 'XLE' },
  'HAL': { sector: 'Energy', industry: 'Oil & Gas Equipment & Services', etf: 'XLE' },

  // Utilities
  'NEE': { sector: 'Utilities', industry: 'Utilities—Regulated Electric', etf: 'XLU' },
  'SO': { sector: 'Utilities', industry: 'Utilities—Regulated Electric', etf: 'XLU' },
  'DUK': { sector: 'Utilities', industry: 'Utilities—Regulated Electric', etf: 'XLU' },
  'AEP': { sector: 'Utilities', industry: 'Utilities—Regulated Electric', etf: 'XLU' },
  'SRE': { sector: 'Utilities', industry: 'Utilities—Regulated Gas', etf: 'XLU' },
  'D': { sector: 'Utilities', industry: 'Utilities—Regulated Electric', etf: 'XLU' },
  'EXC': { sector: 'Utilities', industry: 'Utilities—Regulated Electric', etf: 'XLU' },
  'PCG': { sector: 'Utilities', industry: 'Utilities—Regulated Electric', etf: 'XLU' },

  // Basic Materials
  'LIN': { sector: 'Basic Materials', industry: 'Specialty Chemicals', etf: 'XLB' },
  'APD': { sector: 'Basic Materials', industry: 'Specialty Chemicals', etf: 'XLB' },
  'SHW': { sector: 'Basic Materials', industry: 'Specialty Chemicals', etf: 'XLB' },
  'FCX': { sector: 'Basic Materials', industry: 'Copper', etf: 'XLB' },
  'ECL': { sector: 'Basic Materials', industry: 'Specialty Chemicals', etf: 'XLB' },
  'NEM': { sector: 'Basic Materials', industry: 'Gold', etf: 'XLB' },
  'CTVA': { sector: 'Basic Materials', industry: 'Agricultural Inputs', etf: 'XLB' },

  // Real Estate
  'PLD': { sector: 'Real Estate', industry: 'REIT—Industrial', etf: 'XLRE' },
  'AMT': { sector: 'Real Estate', industry: 'REIT—Specialty', etf: 'XLRE' },
  'CCI': { sector: 'Real Estate', industry: 'REIT—Specialty', etf: 'XLRE' },
  'EQIX': { sector: 'Real Estate', industry: 'REIT—Specialty', etf: 'XLRE' },
  'WY': { sector: 'Real Estate', industry: 'REIT—Specialty', etf: 'XLRE' },
  'PSA': { sector: 'Real Estate', industry: 'REIT—Industrial', etf: 'XLRE' }
};

function loadSectorCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      sectorCache = JSON.parse(data);
      console.log(`Loaded ${Object.keys(sectorCache).length} tickers from sector cache file.`);
    }
  } catch (err) {
    console.error('Failed to load sector cache file:', err.message);
  }
}

function saveSectorCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(sectorCache, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save sector cache file:', err.message);
  }
}

// Load cached sectors immediately
loadSectorCache();

function getSectorInfoForTicker(ticker) {
  const tickerUpper = ticker.toUpperCase();
  if (sectorCache[tickerUpper]) return sectorCache[tickerUpper];
  if (SEED_SECTORS[tickerUpper]) {
    sectorCache[tickerUpper] = SEED_SECTORS[tickerUpper];
    saveSectorCache();
    return SEED_SECTORS[tickerUpper];
  }
  return null;
}

// Nasdaq calendar fetch cache
const nasdaqCalendarCache = {};

async function fetchNasdaqCalendarRows(dateStr) {
  if (nasdaqCalendarCache[dateStr]) {
    return nasdaqCalendarCache[dateStr];
  }
  
  const fetchPromise = (async () => {
    try {
      const nasdaqUrl = `https://api.nasdaq.com/api/calendar/earnings?date=${dateStr}`;
      const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.nasdaq.com/'
      };
      console.log(`Fetching Nasdaq earnings calendar for date: ${dateStr}...`);
      const result = await fetchHttps(nasdaqUrl, headers);
      const json = JSON.parse(result.body);
      if (json.data && json.data.rows) {
        return json.data.rows;
      }
      return [];
    } catch (err) {
      console.error(`Failed to fetch Nasdaq calendar for ${dateStr}:`, err.message);
      return [];
    }
  })();
  
  nasdaqCalendarCache[dateStr] = fetchPromise;
  return fetchPromise;
}

function getPrevious14Days(dateStr) {
  const dates = [];
  const dateObj = new Date(dateStr + 'T00:00:00');
  for (let i = 1; i <= 14; i++) {
    const prevDate = new Date(dateObj);
    prevDate.setDate(dateObj.getDate() - i);
    const dayOfWeek = prevDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const yyyy = prevDate.getFullYear();
      const mm = String(prevDate.getMonth() + 1).padStart(2, '0');
      const dd = String(prevDate.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
  }
  return dates;
}

function parseNumericEps(epsStr) {
  if (!epsStr) return null;
  let clean = epsStr.trim().replace('$', '');
  if (clean.startsWith('(') && clean.endsWith(')')) {
    clean = '-' + clean.slice(1, -1);
  }
  const val = parseFloat(clean);
  return isNaN(val) ? null : val;
}


function getSectorEtf(sectorName) {
  const mapping = {
    'Technology': 'XLK',
    'Consumer Cyclical': 'XLY',
    'Financial Services': 'XLF',
    'Financial': 'XLF',
    'Healthcare': 'XLV',
    'Consumer Defensive': 'XLP',
    'Energy': 'XLE',
    'Basic Materials': 'XLB',
    'Industrials': 'XLI',
    'Utilities': 'XLU',
    'Real Estate': 'XLRE',
    'Communication Services': 'XLC'
  };
  return mapping[sectorName] || 'SPY';
}

async function resolveSectorDynamic(ticker) {
  const info = getSectorInfoForTicker(ticker);
  if (info) return info;
  
  const tickerUpper = ticker.toUpperCase();
  try {
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${tickerUpper}`;
    const searchResult = await fetchHttps(searchUrl);
    const searchData = JSON.parse(searchResult.body);
    const firstQuote = searchData.quotes && searchData.quotes[0];
    const sector = firstQuote ? firstQuote.sector : null;
    const industry = firstQuote ? firstQuote.industry : null;
    const etf = getSectorEtf(sector);
    
    const resolved = { sector, industry, etf };
    sectorCache[tickerUpper] = resolved;
    saveSectorCache();
    return resolved;
  } catch (err) {
    console.error(`Failed to dynamically lookup sector for ${tickerUpper}:`, err.message);
    return { sector: null, industry: null, etf: 'SPY' };
  }
}

function getGoogleFinanceExchange(exchangeName) {
  const mapping = {
    'NMS': 'NASDAQ',
    'NGM': 'NASDAQ',
    'NCM': 'NASDAQ',
    'NYQ': 'NYSE',
    'ASE': 'AMEX'
  };
  return mapping[exchangeName] || 'NASDAQ';
}

function calculateTwoWeekReturn(chartResult) {
  if (!chartResult || !chartResult.indicators || !chartResult.indicators.quote || !chartResult.indicators.quote[0]) {
    return 0;
  }
  const prices = chartResult.indicators.quote[0].close;
  const currentPrice = chartResult.meta.regularMarketPrice;
  const prevClose = chartResult.meta.chartPreviousClose;

  if (prices && prices.length >= 10) {
    const price10DaysAgo = prices[prices.length - 10] || prices[0];
    return ((currentPrice - price10DaysAgo) / price10DaysAgo) * 100;
  } else if (prices && prices.length > 0) {
    const startPrice = prices[0] || prevClose || currentPrice;
    return ((currentPrice - startPrice) / startPrice) * 100;
  }
  return 0;
}

async function getKalshiSeries() {
  const now = Date.now();
  // Cache for 1 hour
  if (kalshiSeriesCache && (now - kalshiSeriesCacheTime < 3600000)) {
    return kalshiSeriesCache;
  }

  try {
    console.log('Fetching Kalshi series list (Mentions category)...');
    const url = 'https://external-api.kalshi.com/trade-api/v2/series?limit=1000&category=Mentions';
    const result = await fetchHttps(url);
    const data = JSON.parse(result.body);
    if (data && data.series) {
      kalshiSeriesCache = data.series;
      kalshiSeriesCacheTime = now;
      console.log(`Successfully cached ${kalshiSeriesCache.length} Kalshi mention series.`);
      return kalshiSeriesCache;
    }
  } catch (error) {
    console.error('Failed to fetch Kalshi series, using fallback:', error.message);
  }
  return kalshiSeriesCache || [];
}

async function findKalshiSeriesForTicker(ticker, companyName) {
  const seriesList = await getKalshiSeries();
  
  const tickerUpper = ticker.toUpperCase();
  const nameLower = (companyName || '').toLowerCase();

  // Try 1: Exact mapping for ticker
  const exactTickerSeries = seriesList.find(s => 
    s.ticker === `KXEARNINGSMENTION${tickerUpper}` || 
    s.ticker === `KXMENTIONEARN${tickerUpper}`
  );
  if (exactTickerSeries) return exactTickerSeries;

  // Try 2: Known common mappings for specific symbols
  const knownMappings = {
    'DOCU': 'DOCUSIGN',
    'CBRL': 'CBRL',
    'RBRK': 'RUBRIK',
    'IOT': 'SAMSARA',
    'LULU': 'LULU'
  };
  const mappedName = knownMappings[tickerUpper];
  if (mappedName) {
    const mappedSeries = seriesList.find(s => 
      s.ticker === `KXEARNINGSMENTION${mappedName}` || 
      s.ticker === `KXMENTIONEARN${mappedName}`
    );
    if (mappedSeries) return mappedSeries;
  }

  // Try 3: Ticker substring matching (if ticker length > 1)
  if (tickerUpper.length > 1) {
    const containingTickerSeries = seriesList.find(s => 
      s.ticker.includes(`EARNINGSMENTION${tickerUpper}`) || 
      s.ticker.includes(`MENTIONEARN${tickerUpper}`) ||
      s.ticker.endsWith(tickerUpper)
    );
    if (containingTickerSeries) return containingTickerSeries;
  }

  // Try 4: Match on company name keywords
  if (nameLower.length > 2) {
    const cleanName = nameLower
      .replace(/\b(inc|corp|co|ltd|corporation|incorporated|class a|class b)\b\.?/gi, '')
      .trim();
    
    const words = cleanName.split(/\s+/).filter(w => w.length > 2);
    if (words.length > 0) {
      const matchByTitle = seriesList.find(s => {
        const titleLower = s.title.toLowerCase();
        return words.some(w => titleLower.includes(w));
      });
      if (matchByTitle) return matchByTitle;
    }
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);

  // Set no-cache for API routes to prevent stale browser caching
  if (pathname.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  }

  // API Route: Polymarket
  if (pathname === '/api/polymarket') {
    try {
      // Query both active and closed earnings markets in parallel
      const activeUrl = 'https://gamma-api.polymarket.com/markets?tag_id=1013&active=true&limit=100';
      const closedUrl = 'https://gamma-api.polymarket.com/markets?tag_id=1013&closed=true&limit=100';

      const [activeRes, closedRes] = await Promise.all([
        fetchHttps(activeUrl),
        fetchHttps(closedUrl)
      ]);

      const activeData = JSON.parse(activeRes.body) || [];
      const closedData = JSON.parse(closedRes.body) || [];

      // Combine active and closed, preventing duplicates by ID
      const combined = [...activeData];
      const activeIds = new Set(activeData.map(m => m.id));
      for (const m of closedData) {
        if (m && m.id && !activeIds.has(m.id)) {
          combined.push(m);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(combined));
    } catch (error) {
      console.error('Polymarket Proxy Error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch Polymarket data', details: error.message }));
    }
    return;
  }

  // API Route: Nasdaq
  if (pathname === '/api/nasdaq') {
    const dateParam = parsedUrl.searchParams.get('date');
    
    // Default to today's date if not provided (server local time, formatted as YYYY-MM-DD)
    let date = dateParam;
    if (!date) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      date = `${yyyy}-${mm}-${dd}`;
    }

    try {
      const rows = await fetchNasdaqCalendarRows(date);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: { rows } }));
    } catch (error) {
      console.error('Nasdaq Proxy Error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch Nasdaq earnings data', details: error.message }));
    }
    return;
  }

  // API Route: Yahoo Finance Quote & History
  if (pathname === '/api/quote') {
    const symbol = parsedUrl.searchParams.get('symbol');
    if (!symbol) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing symbol parameter' }));
      return;
    }

    try {
      const tickerUpper = symbol.toUpperCase();
      const sectorInfo = await resolveSectorDynamic(tickerUpper);

      // Fetch company chart and sector ETF chart in parallel
      const companyChartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${tickerUpper}?interval=1d&range=1mo`;
      const etfChartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${sectorInfo.etf}?interval=1d&range=1mo`;

      const [companyRes, etfRes] = await Promise.all([
        fetchHttps(companyChartUrl),
        fetchHttps(etfChartUrl)
      ]);

      const companyData = JSON.parse(companyRes.body);
      const etfData = JSON.parse(etfRes.body);

      const etfReturn = calculateTwoWeekReturn(etfData.chart.result[0]);

      const chartMeta = companyData.chart && companyData.chart.result && companyData.chart.result[0] && companyData.chart.result[0].meta;
      const exchangeName = chartMeta ? chartMeta.exchangeName : null;
      const googleExchange = getGoogleFinanceExchange(exchangeName);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        chart: companyData.chart,
        sector: sectorInfo.sector,
        industry: sectorInfo.industry,
        sectorEtf: sectorInfo.etf,
        sectorEtfReturn: etfReturn,
        googleExchange: googleExchange
      }));
    } catch (error) {
      console.error(`Yahoo Quote Error for ${symbol}:`, error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Failed to fetch quote for ${symbol}`, details: error.message }));
    }
    return;
  }

  // API Route: Sector Stats (14-day history aggregation)
  if (pathname === '/api/sector-stats') {
    const sector = parsedUrl.searchParams.get('sector');
    const date = parsedUrl.searchParams.get('date');
    
    if (!sector || !date) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing sector or date parameter' }));
      return;
    }
    
    try {
      const weekdays = getPrevious14Days(date);
      console.log(`Calculating sector stats for '${sector}' prior to ${date} across weekdays:`, weekdays);
      
      // Fetch calendars in parallel
      const calendarPromises = weekdays.map(d => fetchNasdaqCalendarRows(d));
      const calendars = await Promise.all(calendarPromises);
      
      // Flatten all calendar rows
      const allRows = calendars.flat();
      
      // Filter rows by sector
      // First, get all tickers and resolve their sectors in parallel
      const uniqueTickers = [...new Set(allRows.map(r => r.symbol).filter(Boolean))];
      
      const sectorResolutions = await Promise.all(uniqueTickers.map(async (ticker) => {
        const info = await resolveSectorDynamic(ticker);
        return { ticker, info };
      }));
      
      const tickerSectorMap = {};
      sectorResolutions.forEach(r => {
        if (r.info && r.info.sector) {
          tickerSectorMap[r.ticker.toUpperCase()] = r.info.sector.toLowerCase();
        }
      });
      
      const targetSectorLower = sector.toLowerCase();
      const sectorRows = allRows.filter(row => {
        if (!row || !row.symbol) return false;
        const s = tickerSectorMap[row.symbol.toUpperCase()];
        return s === targetSectorLower;
      });
      
      // Aggregate stats
      let totalReports = 0;
      let beats = 0;
      let misses = 0;
      
      sectorRows.forEach(row => {
        const forecastVal = parseNumericEps(row.epsForecast);
        const actualVal = parseNumericEps(row.eps);
        
        if (forecastVal !== null && actualVal !== null) {
          totalReports++;
          if (actualVal >= forecastVal) {
            beats++;
          } else {
            misses++;
          }
        }
      });
      
      const beatRate = totalReports > 0 ? (beats / totalReports) * 100 : 0;
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        sector,
        totalReports,
        beats,
        misses,
        beatRate
      }));
    } catch (error) {
      console.error('Sector stats calculations failed:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to calculate sector stats', details: error.message }));
    }
    return;
  }


  // API Route: Kalshi Prediction Markets for Ticker
  if (pathname === '/api/kalshi') {
    const ticker = parsedUrl.searchParams.get('ticker');
    const company = parsedUrl.searchParams.get('company') || '';
    if (!ticker) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing ticker parameter' }));
      return;
    }

    try {
      const series = await findKalshiSeriesForTicker(ticker, company);
      if (!series) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ markets: [], series: null }));
        return;
      }

      // Fetch active markets for the matched series
      const marketsUrl = `https://external-api.kalshi.com/trade-api/v2/markets?status=open&series_ticker=${series.ticker}`;
      const result = await fetchHttps(marketsUrl);
      const data = JSON.parse(result.body);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        series: series,
        markets: data.markets || []
      }));
    } catch (error) {
      console.error(`Kalshi Proxy Error for ${ticker}:`, error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Failed to fetch Kalshi data for ${ticker}`, details: error.message }));
    }
    return;
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  
  // Safe path check to prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
