// Get today's local date in YYYY-MM-DD format
function getTodayDateStr() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// State variables
let selectedDate = getTodayDateStr();
let polymarketMarkets = [];
let nasdaqEarnings = [];
let searchQuery = '';
let selectedTicker = null;

// DOM Elements
const datePicker = document.getElementById('datePicker');
const displayDate = document.getElementById('displayDate');
const btnPrevDay = document.getElementById('btnPrevDay');
const btnNextDay = document.getElementById('btnNextDay');
const searchBar = document.getElementById('searchBar');

const containerMatched = document.getElementById('containerMatched');
const containerUnmatched = document.getElementById('containerUnmatched');
const loaderMatched = document.getElementById('loaderMatched');
const loaderUnmatched = document.getElementById('loaderUnmatched');
const emptyMatched = document.getElementById('emptyMatched');
const emptyUnmatched = document.getElementById('emptyUnmatched');

const badgeMatchedCount = document.getElementById('badgeMatchedCount');
const badgeUnmatchedCount = document.getElementById('badgeUnmatchedCount');
const lastUpdated = document.getElementById('lastUpdated');

// Stats Elements
const statMatches = document.getElementById('statMatches');
const statTotalEarnings = document.getElementById('statTotalEarnings');
const statVolume = document.getElementById('statVolume');
const statSentiment = document.getElementById('statSentiment');

// Detail Drawer Elements
const detailDrawer = document.getElementById('detailDrawer');
const closeDrawer = document.getElementById('closeDrawer');
const drawerTicker = document.getElementById('drawerTicker');
const drawerTime = document.getElementById('drawerTime');
const drawerCompany = document.getElementById('drawerCompany');
const drawerQuestion = document.getElementById('drawerQuestion');
const drawerYesPrice = document.getElementById('drawerYesPrice');
const drawerNoPrice = document.getElementById('drawerNoPrice');
const drawerTargetEps = document.getElementById('drawerTargetEps');
const drawerForecastEps = document.getElementById('drawerForecastEps');
const drawerActualEps = document.getElementById('drawerActualEps');
const drawerSurprise = document.getElementById('drawerSurprise');
const drawerNoOfEsts = document.getElementById('drawerNoOfEsts');
const drawerEpsType = document.getElementById('drawerEpsType');
const drawerDescription = document.getElementById('drawerDescription');
const btnLinkPolymarket = document.getElementById('btnLinkPolymarket');
const btnLinkNasdaq = document.getElementById('btnLinkNasdaq');

// Strategy Guide DOM Elements
const btnToggleStrategy = document.getElementById('btnToggleStrategy');
const strategyContent = document.getElementById('strategyContent');
const strategyIndicator = document.getElementById('strategyIndicator');

// Strategic Trade Assessment drawer fields
const drawerWhisperDelta = document.getElementById('drawerWhisperDelta');
const drawerSignalStrength = document.getElementById('drawerSignalStrength');
const drawerStrategicAnalysis = document.getElementById('drawerStrategicAnalysis');
const drawerCurrentPrice = document.getElementById('drawerCurrentPrice');
const drawerStockReturn = document.getElementById('drawerStockReturn');
const drawerOpportunityRating = document.getElementById('drawerOpportunityRating');
const drawer52WeekRange = document.getElementById('drawer52WeekRange');
const drawerSectorBeatLabel = document.getElementById('drawerSectorBeatLabel');
const drawerSectorBeatRate = document.getElementById('drawerSectorBeatRate');
const drawerSectorBeatRatio = document.getElementById('drawerSectorBeatRatio');

// ==========================================================================
// HELPERS & PARSERS
// ==========================================================================

// Format Date for Display: "June 4, 2026"
function formatDateForDisplay(dateStr) {
  if (!dateStr) return 'Select Date';
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function getDetailedAnnounceTime(ticker, rawTime) {
  const tickerUpper = (ticker || '').toUpperCase();
  const exactTimes = {
    'LULU': '4:05 PM ET (Conference Call at 4:30 PM)',
    'DOCU': '4:05 PM ET (Conference Call at 5:00 PM)',
    'RBRK': '4:05 PM ET (Conference Call at 5:00 PM)',
    'IOT': '4:05 PM ET (Conference Call at 5:00 PM)',
    'CIEN': '7:00 AM ET',
    'CBRL': '8:00 AM ET',
    'PL': '4:00 PM ET'
  };

  if (exactTimes[tickerUpper]) {
    return exactTimes[tickerUpper];
  }

  let cleanTime = rawTime || '';
  if (cleanTime === 'time-after-hours') cleanTime = 'After Hours';
  if (cleanTime === 'time-pre-market') cleanTime = 'Pre Market';
  if (cleanTime === 'time-not-supplied') cleanTime = 'Not Supplied';

  if (cleanTime === 'After Hours') {
    return 'After Hours (~4:00 PM - 5:00 PM ET)';
  }
  if (cleanTime === 'Pre Market') {
    return 'Pre Market (~7:00 AM - 9:00 AM ET)';
  }
  if (cleanTime === 'Not Supplied') {
    return 'Time Not Supplied';
  }
  return cleanTime || 'Time N/A';
}

function getShortAnnounceTime(ticker, rawTime) {
  const tickerUpper = (ticker || '').toUpperCase();
  const exactShortTimes = {
    'LULU': '4:05 PM ET',
    'DOCU': '4:05 PM ET',
    'RBRK': '4:05 PM ET',
    'IOT': '4:05 PM ET',
    'CIEN': '7:00 AM ET',
    'CBRL': '8:00 AM ET',
    'PL': '4:00 PM ET'
  };

  if (exactShortTimes[tickerUpper]) {
    return exactShortTimes[tickerUpper];
  }

  let cleanTime = rawTime || '';
  if (cleanTime === 'time-after-hours') cleanTime = 'After Hours';
  if (cleanTime === 'time-pre-market') cleanTime = 'Pre Market';
  if (cleanTime === 'time-not-supplied') cleanTime = 'Not Supplied';
  return cleanTime || 'Time N/A';
}

// Extract Ticker from Polymarket Question: "Will lululemon athletica (LULU) beat..." -> "LULU"
function extractTicker(question) {
  const match = question.match(/\(([A-Z]+)\)/);
  return match ? match[1] : null;
}

// Parse Target EPS from Polymarket Slug: "lulu-quarterly-earnings-gaap-eps-06-04-2026-1pt68" -> "$1.68"
function parseTargetEpsFromSlug(slug) {
  if (!slug) return '-';
  
  // Look for the end section of the slug after the date (which is usually XX-XX-XXXX-...)
  const parts = slug.split('-');
  const lastPart = parts[parts.length - 1]; // e.g. "1pt68", "neg0pt03", "1", "neg2"
  
  if (!lastPart) return '-';

  let isNegative = lastPart.startsWith('neg');
  let cleanPart = isNegative ? lastPart.substring(3) : lastPart; // e.g. "0pt03", "1pt68", "1"

  let valueStr = '';
  if (cleanPart.includes('pt')) {
    valueStr = cleanPart.replace('pt', '.'); // e.g. "0.03", "1.68"
  } else {
    valueStr = cleanPart; // integer value, e.g. "1"
  }

  const num = parseFloat(valueStr);
  if (isNaN(num)) return '-';

  const formattedVal = (isNegative ? -num : num).toFixed(2);
  return `$${formattedVal}`;
}

// Determine GAAP or Non-GAAP from slug
function parseEpsType(slug) {
  if (!slug) return 'GAAP';
  if (slug.includes('nongaap')) return 'Non-GAAP';
  if (slug.includes('gaap')) return 'GAAP';
  return 'EPS';
}

// Format Currency
function formatCurrency(val) {
  if (!val) return '$0';
  const num = parseFloat(val);
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}k`;
  return `$${num.toFixed(0)}`;
}

// Parse EPS string like "$1.67", "-$0.03", "($0.02)" into a clean number
function parseNumericEps(epsStr) {
  if (!epsStr) return null;
  let clean = epsStr.trim().replace('$', '');
  // Nasdaq uses parentheses for negative values, e.g. "($0.02)"
  if (clean.startsWith('(') && clean.endsWith(')')) {
    clean = '-' + clean.slice(1, -1);
  }
  const val = parseFloat(clean);
  return isNaN(val) ? null : val;
}

// Calculate delta between Polymarket Target and Nasdaq Forecast
function calculateDelta(polyTarget, nasdaqForecast) {
  const polyVal = parseNumericEps(polyTarget);
  const nasdaqVal = parseNumericEps(nasdaqForecast);
  
  if (polyVal === null || nasdaqVal === null) return null;
  
  const diff = polyVal - nasdaqVal;
  const sign = diff >= 0 ? '+' : '';
  
  // Calculate percentage difference if base isn't 0
  let pctStr = '';
  if (nasdaqVal !== 0) {
    const pct = (diff / Math.abs(nasdaqVal)) * 100;
    pctStr = ` (${diff >= 0 ? '+' : ''}${pct.toFixed(0)}%)`;
  }
  
  return {
    value: diff,
    text: `${sign}$${diff.toFixed(2)}${pctStr}`
  };
}

// Get signal strength rating based on contract trade volume
function getSignalStrength(volume) {
  const vol = parseFloat(volume) || 0;
  if (vol >= 50000) {
    return { rating: 'Strong Signal', class: 'signal-strong', desc: 'Institutional speculation' };
  } else if (vol >= 10000) {
    return { rating: 'Moderate Signal', class: 'signal-moderate', desc: 'Active retail & light volume' };
  } else {
    return { rating: 'Weak Signal', class: 'signal-weak', desc: 'Speculative retail (shallow pool)' };
  }
}

// Generate tailored strategic trade analysis details
function getStrategicAnalysisText(ticker, delta, signal, yesPrice, priceDetails) {
  const deltaText = delta ? delta.text : 'N/A';
  const beatProb = Math.round(yesPrice * 100);
  
  // Format price return details
  let returnText = 'N/A';
  let correctionStatus = 'Unknown correction state.';
  
  if (priceDetails && priceDetails.twoWeekReturn !== undefined) {
    const retVal = priceDetails.twoWeekReturn;
    const relVal = priceDetails.relativeReturn !== undefined ? priceDetails.relativeReturn : retVal;
    const sectorEtf = priceDetails.sectorEtf || 'Sector';
    
    const sign = retVal >= 0 ? '+' : '';
    const relSign = relVal >= 0 ? '+' : '';
    
    returnText = `${sign}${retVal.toFixed(1)}% absolute (${relSign}${relVal.toFixed(1)}% relative to ${sectorEtf})`;
    
    if (relVal >= 7.5) {
      correctionStatus = `<span class="miss"><strong>Priced-In (Market Corrected):</strong> The stock has rallied strongly relative to its sector (${relSign}${relVal.toFixed(1)}% vs ${sectorEtf}) leading up to earnings. This suggests the equity market has already absorbed the higher expectation relative to its peers, creating a 'sell the news' risk.</span>`;
    } else if (relVal <= 3.0) {
      correctionStatus = `<span class="beat"><strong>Undervalued Opportunity:</strong> The stock is trading flat or underperforming relative to its sector (${relSign}${relVal.toFixed(1)}% vs ${sectorEtf}) over the last 2 weeks despite a large beat consensus. The market has NOT corrected, representing a high-probability relative mispricing.</span>`;
    } else {
      correctionStatus = `<strong>Muted / Partially Corrected:</strong> The stock relative return (${relSign}${relVal.toFixed(1)}% vs ${sectorEtf}) indicates moderate pricing adjustment. Treat directional trades with caution.`;
    }
  }

  // Price vs Value Conviction calculation
  let convictionLevel = 'Low / Mixed';
  let convictionReason = 'Expectation delta is aligned and relative performance is neutral.';
  
  const hasDelta = delta && Math.abs(delta.value) >= 0.01;
  const isStrongSignal = signal.rating === 'Strong Signal';
  const isUndervaluedRel = priceDetails && priceDetails.relativeReturn <= 3.0;
  const isPricedInRel = priceDetails && priceDetails.relativeReturn >= 7.5;
  
  if (hasDelta && isUndervaluedRel && isStrongSignal) {
    convictionLevel = '⚡ High Conviction (Undervalued)';
    convictionReason = 'The market price has not run up to price in the event (+2-week return is flat/down), there is a significant expectation delta, and contract volume is high (strong institutional interest).';
  } else if (hasDelta && isPricedInRel) {
    convictionLevel = '⚠️ High Conviction (Priced In)';
    convictionReason = 'The stock has run up strongly relative to its sector (+2-week relative return is high), suggesting the market has already corrected to absorb the earnings expectation. Short-term upside on a beat may be capped.';
  } else if (!hasDelta && isUndervaluedRel && isStrongSignal) {
    convictionLevel = 'Moderate Conviction';
    convictionReason = 'Consensus estimates are aligned between analysts and prediction markets, but the stock remains relatively undervalued compared to its sector leading into the release, offering a safety margin.';
  } else if (signal.rating === 'Weak Signal') {
    convictionLevel = 'Low Conviction (Speculative)';
    convictionReason = 'Prediction contract volume is shallow (weak signal), meaning odds are driven by thin retail speculation and are vulnerable to sudden manipulation.';
  }

  const tips = {
    'LULU': `<strong>Lululemon ($LULU) Strategy Notes:</strong><br/>
      • <strong>Expectation Delta:</strong> Aligned (${deltaText} relative to forecast).<br/>
      • <strong>2-Week Performance:</strong> ${returnText} return. ${correctionStatus}<br/>
      • <strong>Price vs Value Conviction: <span class="opp-neutral">Moderate</span></strong> (Mixed inputs: backward-looking beat is highly probable [${beatProb}%], but forward Q2 guidance is the real driver. A soft outlook due to athleisure consumer patterns could sink the stock despite a Q1 headline beat).<br/>
      • <strong>Opportunity:</strong> Look to fade initial algorithmic spikes if headline beats but Q2 guidance underperforms.`,
    
    'DOCU': `<strong>DocuSign ($DOCU) Strategy Notes:</strong><br/>
      • <strong>Whisper Discrepancy:</strong> Polymarket expects $0.99 EPS vs. Wall Street's $0.38 consensus forecast (a massive delta of ${deltaText}).<br/>
      • <strong>Correction Check:</strong> 2-week stock return is <strong>${returnText}</strong>.<br/>
      • <strong>Price vs Value Conviction: <span class="${isUndervaluedRel ? 'delta-pos' : 'delta-neg'}">${isUndervaluedRel ? '⚡ High (Undervalued)' : '⚠️ Low/Priced-In'}</span></strong> (${isUndervaluedRel ? 'The market has NOT yet run up, meaning the $0.61 whisper beat represents a high-probability relative mispricing.' : 'The market has already run up, suggesting the whisper beat is priced in. Do not chase the long side.'})<br/>
      • <strong>Opportunity:</strong> Long trade holds conviction ONLY if relative return remains flat or negative leading into release.`,
    
    'RBRK': `<strong>Rubrik ($RBRK) Strategy Notes:</strong><br/>
      • <strong>High-Probability Beat:</strong> Targeting -$0.03 EPS vs. Nasdaq forecast of -$0.44. Speculators price in a ${beatProb}% probability of beating.<br/>
      • <strong>Price vs Value Conviction: <span class="delta-neg">Low (Speculative)</span></strong> (The prediction contract volume is shallow [weak signal], meaning odds represent retail speculation rather than institutional positioning. Treat the beat probability with caution).<br/>
      • <strong>Verdict:</strong> ${correctionStatus} Rubrik's 2-week price movement is ${returnText}. Focus on growth guidance rather than headline prediction contracts.`,
      
    'IOT': `<strong>Samsara ($IOT) Strategy Notes:</strong><br/>
      • <strong>Beat Chance:</strong> Extremely high beat probability (${beatProb}%).<br/>
      • <strong>Price vs Value Conviction: <span class="opp-neutral">Mixed / High Risk</span></strong> (Options markets price in a huge implied move (~15%) and expensive put skew, indicating market fear of forward guidance regardless of a beat. High pricing volatility risk).<br/>
      • <strong>Verdict:</strong> ${correctionStatus} Samsara's 2-week return is ${returnText}. A volatility crush play (selling expensive premium) might be the primary opportunity if the price reaction is muted.`
  };
  
  return tips[ticker.toUpperCase()] || `<strong>Price vs Value Assessment for ${ticker}:</strong><br/>
    • <strong>Price vs Value Consensus:</strong> The current market price ($${priceDetails ? priceDetails.currentPrice.toFixed(2) : '-'}) represents general investor sentiment. The expected "Value" target (analyst vs prediction consensus) indicates an expectation delta of <strong>${deltaText}</strong>.<br/>
    • <strong>Relative Valuation:</strong> Stock return is ${returnText}. ${correctionStatus}<br/>
    • <strong>Valuation Conviction: <span class="${isStrongSignal && isUndervaluedRel ? 'delta-pos' : (isPricedInRel ? 'delta-neg' : '')}">${convictionLevel}</span></strong><br/>
      <em>${convictionReason}</em><br/>
    • <strong>Signal Liquidity:</strong> Rated as <strong>${signal.rating}</strong> (${signal.desc}).`;
}

// ==========================================================================
// CORE API DATA FETCHERS
// ==========================================================================

// Fetch Polymarket contracts
async function fetchPolymarketData() {
  loaderMatched.classList.remove('hidden');
  try {
    const res = await fetch('/api/polymarket');
    if (!res.ok) throw new Error('API server returned error code');
    const data = await res.json();
    
    // Process Polymarket contracts
    polymarketMarkets = data.map(m => {
      const ticker = extractTicker(m.question || m.title || '');
      const targetEps = parseTargetEpsFromSlug(m.slug);
      const epsType = parseEpsType(m.slug);
      
      let yesPrice = 0.50;
      let noPrice = 0.50;
      if (m.outcomePrices) {
        try {
          const prices = JSON.parse(m.outcomePrices);
          yesPrice = parseFloat(prices[0]) || 0;
          noPrice = parseFloat(prices[1]) || 0;
        } catch (e) {
          if (Array.isArray(m.outcomePrices)) {
            yesPrice = parseFloat(m.outcomePrices[0]) || 0;
            noPrice = parseFloat(m.outcomePrices[1]) || 0;
          }
        }
      }

      return {
        id: m.id,
        question: m.question,
        slug: m.slug,
        ticker: ticker,
        endDate: m.endDateIso,
        yesPrice: yesPrice,
        noPrice: noPrice,
        volume: m.volumeNum || parseFloat(m.volume) || 0,
        liquidity: m.liquidityNum || parseFloat(m.liquidity) || 0,
        description: m.description,
        targetEps: targetEps,
        epsType: epsType,
        closed: m.closed === true || m.closed === 'true',
        originalData: m
      };
    }).filter(m => m.ticker !== null); // Only keep contracts where we could extract a ticker

    console.log(`Loaded ${polymarketMarkets.length} processed Polymarket contracts.`);
  } catch (error) {
    console.error('Error fetching Polymarket data:', error);
  } finally {
    loaderMatched.classList.add('hidden');
  }
}

// Fetch Nasdaq calendar for the selected date
async function fetchNasdaqData(date) {
  loaderUnmatched.classList.remove('hidden');
  containerUnmatched.innerHTML = '';
  emptyUnmatched.classList.add('hidden');
  
  try {
    const res = await fetch(`/api/nasdaq?date=${date}`);
    if (!res.ok) throw new Error('API server returned error code');
    const json = await res.json();
    
    if (json.data && json.data.rows) {
      nasdaqEarnings = json.data.rows;
    } else {
      nasdaqEarnings = [];
    }
    console.log(`Loaded ${nasdaqEarnings.length} Nasdaq earnings events for ${date}.`);
  } catch (error) {
    console.error('Error fetching Nasdaq data:', error);
    nasdaqEarnings = [];
  } finally {
    loaderUnmatched.classList.add('hidden');
  }
}

// ==========================================================================
// MATCHING & RENDERING LOGIC
// ==========================================================================

function renderDashboard() {
  const query = searchQuery.trim().toLowerCase();

  // 1. Matches: Companies reporting today that have an active Polymarket contract
  // Note: Nasdaq tickers are matched case-sensitively with extracted Polymarket tickers.
  const matchedList = [];
  const unmatchedList = [];

  nasdaqEarnings.forEach(row => {
    if (!row || !row.symbol) return;
    const rowSymbolUpper = row.symbol.toUpperCase();
    const rowNameLower = (row.name || '').toLowerCase();
    
    // Find matching Polymarket contract by Ticker
    const match = polymarketMarkets.find(m => m.ticker && m.ticker.toUpperCase() === rowSymbolUpper);
    
    // Check if searches filter this symbol or name
    const matchesSearch = !query || 
                          row.symbol.toLowerCase().includes(query) || 
                          rowNameLower.includes(query);

    if (!matchesSearch) return;

    if (match) {
      matchedList.push({
        nasdaq: row,
        polymarket: match
      });
    } else {
      unmatchedList.push(row);
    }
  });

  // Calculate and Render Stats
  renderStats(matchedList, unmatchedList);

  // Render Matched Panel (Column 1)
  containerMatched.innerHTML = '';
  if (matchedList.length === 0) {
    emptyMatched.classList.remove('hidden');
    badgeMatchedCount.textContent = '0';
  } else {
    emptyMatched.classList.add('hidden');
    badgeMatchedCount.textContent = matchedList.length;

    matchedList.forEach(item => {
      const card = createMatchedCard(item);
      containerMatched.appendChild(card);
    });
  }

  // Render Unmatched Panel (Column 2)
  containerUnmatched.innerHTML = '';
  if (unmatchedList.length === 0) {
    emptyUnmatched.classList.remove('hidden');
    badgeUnmatchedCount.textContent = '0';
  } else {
    emptyUnmatched.classList.add('hidden');
    badgeUnmatchedCount.textContent = unmatchedList.length;

    unmatchedList.forEach(row => {
      const card = createUnmatchedCard(row);
      containerUnmatched.appendChild(card);
    });
  }
}

// Render Header Stats Bar
function renderStats(matched, unmatched) {
  statMatches.textContent = matched.length;
  statTotalEarnings.textContent = matched.length + unmatched.length;
  
  // Total Volume
  const totalVol = matched.reduce((acc, curr) => acc + curr.polymarket.volume, 0);
  statVolume.textContent = totalVol > 0 ? formatCurrency(totalVol) : '$0';
  
  // Sentiment (Average probability of Beat)
  if (matched.length > 0) {
    const totalYes = matched.reduce((acc, curr) => acc + curr.polymarket.yesPrice, 0);
    const avgYes = (totalYes / matched.length) * 100;
    statSentiment.textContent = `${avgYes.toFixed(1)}%`;
  } else {
    statSentiment.textContent = '-';
  }

  lastUpdated.textContent = new Date().toLocaleTimeString();
}

// Global cache for stock price history to prevent redundant fetches
const priceHistoryCache = {};

// Asynchronously load and update price details on a matched card
async function updateCardPriceDetails(ticker, cardElement, yesPrice, item) {
  const priceDisplay = cardElement.querySelector('.card-price-display');
  if (!priceDisplay) return;

  let data;
  if (priceHistoryCache[ticker]) {
    data = priceHistoryCache[ticker];
  } else {
    try {
      const res = await fetch(`/api/quote?symbol=${ticker}`);
      if (!res.ok) throw new Error('Fetch failed');
      const json = await res.json();
      const result = json.chart.result[0];
      const prices = result.indicators.quote[0].close;
      const currentPrice = result.meta.regularMarketPrice;
      const prevClose = result.meta.chartPreviousClose;
      const high = result.meta.fiftyTwoWeekHigh;
      const low = result.meta.fiftyTwoWeekLow;

      // Calculate 2-week performance return (approx 10 trading days)
      let returnPct = 0;
      if (prices && prices.length >= 10) {
        const price10DaysAgo = prices[prices.length - 10] || prices[0];
        returnPct = ((currentPrice - price10DaysAgo) / price10DaysAgo) * 100;
      } else if (prices && prices.length > 0) {
        const startPrice = prices[0] || prevClose || currentPrice;
        returnPct = ((currentPrice - startPrice) / startPrice) * 100;
      }

      // Calculate 52-week position percentile
      let rangePos = 50;
      if (high > low) {
        rangePos = ((currentPrice - low) / (high - low)) * 100;
      }

      const relativeReturn = returnPct - (json.sectorEtfReturn || 0);

      data = {
        currentPrice,
        prevClose,
        twoWeekReturn: returnPct,
        fiftyTwoWeekHigh: high,
        fiftyTwoWeekLow: low,
        fiftyTwoWeekPos: rangePos,
        prices,
        sector: json.sector,
        industry: json.industry,
        sectorEtf: json.sectorEtf,
        sectorEtfReturn: json.sectorEtfReturn,
        relativeReturn,
        googleExchange: json.googleExchange
      };
      priceHistoryCache[ticker] = data;
    } catch (e) {
      console.error(`Failed to load price details for ${ticker}:`, e.message);
      priceDisplay.textContent = 'Price N/A';
      return;
    }
  }

  // Bind quote details back to matched item reference for drawer use
  item.priceDetails = data;

  if (!data || typeof data.currentPrice !== 'number') {
    priceDisplay.textContent = 'Price N/A';
    return;
  }

  // Update card earnings link once googleExchange is resolved
  const earningsLink = cardElement.querySelector('.card-earnings-link');
  if (earningsLink && data.googleExchange) {
    earningsLink.href = `https://www.google.com/finance/beta/quote/${ticker.toUpperCase()}:${data.googleExchange}?tab=earnings`;
    earningsLink.classList.remove('hidden');
    earningsLink.addEventListener('click', (e) => e.stopPropagation());
  }

  // Render price and return percentage with colored arrows
  const sign = data.twoWeekReturn >= 0 ? '+' : '';
  const returnClass = data.twoWeekReturn >= 0 ? 'delta-pos' : 'delta-neg';
  const arrow = data.twoWeekReturn >= 0 ? '▲' : '▼';
  
  const relSign = data.relativeReturn >= 0 ? '+' : '';
  const relClass = data.relativeReturn >= 0 ? 'delta-pos' : 'delta-neg';
  const sectorLabel = data.sectorEtf || 'Sector';

  priceDisplay.innerHTML = `<span class="price-val">$${data.currentPrice.toFixed(2)}</span> <span class="price-ret ${returnClass}" title="2-Week absolute stock performance return">${arrow} ${sign}${data.twoWeekReturn.toFixed(1)}%</span> <span class="price-ret ${relClass}" style="opacity: 0.85; font-size: 9px; font-weight: normal;" title="2-Week return relative to sector ETF ${sectorLabel}">${relSign}${data.relativeReturn.toFixed(1)}% vs ${sectorLabel}</span>`;

  // Determine Opportunity/Priced-In Rating (based on Sector-Relative return)
  let rating = 'Aligned / Mixed';
  let ratingClass = 'opp-neutral';
  
  if (yesPrice >= 0.70) {
    if (data.relativeReturn <= 3.0) {
      rating = '⚡ Opportunity (Flat/Down)';
      ratingClass = 'opp-high';
      cardElement.classList.add('glow-opp-high'); // Apply glowing opportunity border
    } else if (data.relativeReturn >= 7.5) {
      rating = '⚠️ Likely Priced In';
      ratingClass = 'opp-priced-in';
      cardElement.classList.add('glow-opp-priced-in'); // Apply warning border
    } else {
      rating = 'Aligned / Neutral';
      ratingClass = 'opp-neutral';
    }
  } else {
    rating = 'Muted / Neutral';
    ratingClass = 'opp-neutral';
  }

  data.rating = rating;
  data.ratingClass = ratingClass;

  // If this card is currently selected and the drawer is open, update drawer price fields!
  if (selectedTicker === ticker && detailDrawer && !detailDrawer.classList.contains('hidden')) {
    updateDrawerPriceFields(data, item);
  }
}

// Asynchronously fetch Kalshi active markets count to display badge on matched cards
async function updateCardKalshiBadge(ticker, cardElement, companyName) {
  try {
    const res = await fetch(`/api/kalshi?ticker=${ticker}&company=${encodeURIComponent(companyName)}`);
    if (!res.ok) throw new Error('Fetch failed');
    const data = await res.json();
    if (data.markets && data.markets.length > 0) {
      const badge = cardElement.querySelector('.card-kalshi-badge');
      if (badge) {
        badge.textContent = `Kalshi: ${data.markets.length} Mentions`;
        badge.classList.remove('hidden');
      }
      
      // Update comparison grid box!
      const compBox = cardElement.querySelector('.kalshi-comp-box');
      const compVal = cardElement.querySelector('.kalshi-value');
      if (compBox && compVal) {
        compVal.textContent = `${data.markets.length} Words`;
        compBox.classList.remove('hidden');
      }
    }
  } catch (e) {
    console.error(`Failed to load Kalshi badge for ${ticker}:`, e.message);
  }
}

// Create Matched Card Element
function createMatchedCard(item) {
  const { nasdaq, polymarket } = item;
  const card = document.createElement('div');
  card.className = 'matched-card';
  
  // Setup actual reported EPS status
  let actualEpsHtml = '';
  if (nasdaq.eps) {
    const estimate = parseFloat((nasdaq.epsForecast || '').replace('$', ''));
    const actual = parseFloat(nasdaq.eps.replace('$', ''));
    const isBeat = actual >= estimate;
    const statusClass = isBeat ? 'beat' : 'miss';
    actualEpsHtml = `<span class="comp-value actual ${statusClass}">${nasdaq.eps}</span>`;
  } else if (polymarket.closed) {
    const isBeat = polymarket.yesPrice > 0.9;
    const statusClass = isBeat ? 'beat' : 'miss';
    const label = isBeat ? 'Beat' : 'Miss/Inline';
    actualEpsHtml = `<span class="comp-value actual ${statusClass}" title="Actual EPS not yet updated on Nasdaq calendar; result sourced from Polymarket contract resolution.">${label} (Poly)</span>`;
  } else {
    actualEpsHtml = `<span class="comp-value actual">-</span><button class="btn-manual-eps" title="Enter actual EPS manually" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size:10px; margin-left:4px; padding:0 2px;">✎</button>`;
  }

  const yesPercent = (polymarket.yesPrice * 100).toFixed(1);
  const noPercent = (polymarket.noPrice * 100).toFixed(1);

  const timeShort = getShortAnnounceTime(polymarket.ticker, nasdaq.time);
  const timeFull = getDetailedAnnounceTime(polymarket.ticker, nasdaq.time);

  // Calculate Delta & Signal badges
  const delta = calculateDelta(polymarket.targetEps, nasdaq.epsForecast);
  let deltaHtml = '';
  if (delta && Math.abs(delta.value) >= 0.01) {
    const isPositive = delta.value >= 0;
    const badgeClass = isPositive ? 'delta-pos' : 'delta-neg';
    const arrow = isPositive ? '▲' : '▼';
    deltaHtml = `<span class="card-delta-badge ${badgeClass}">${arrow} Delta: ${delta.value >= 0 ? '+' : ''}${delta.value.toFixed(2)}</span>`;
  }

  const signal = getSignalStrength(polymarket.volume);
  const signalHtml = polymarket.closed 
    ? `<span class="card-signal-badge signal-closed">Resolved</span>`
    : `<span class="card-signal-badge ${signal.class}">${signal.rating}</span>`;
  const kalshiBadgeHtml = `<span class="card-kalshi-badge hidden">Kalshi Active</span>`;

  card.innerHTML = `
    <div class="card-header-row">
      <div class="ticker-group">
        <span class="ticker-badge">${polymarket.ticker}</span>
        <span class="company-name" title="${nasdaq.name}">${nasdaq.name}</span>
        <a href="#" target="_blank" class="card-earnings-link hidden">
          Earnings
          <svg width="8" height="8" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="margin-left: 2px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
        </a>
      </div>
      <div class="header-right-group">
        <span class="card-price-display">Loading price...</span>
        <span class="time-badge" title="Announcement time: ${timeFull}">${timeShort}</span>
      </div>
    </div>
    
    <div class="card-badges-row">
      ${deltaHtml}
      ${signalHtml}
      ${kalshiBadgeHtml}
    </div>
    
    <div class="card-comparisons">
      <div class="comp-box" title="The fixed target (strike price) set at contract creation, based on Seeking Alpha analyst consensus.">
        <span class="comp-label">Poly Target (SA)</span>
        <span class="comp-value target">${polymarket.targetEps}</span>
      </div>
      <div class="comp-box kalshi-comp-box hidden">
        <span class="comp-label">Kalshi Mentions</span>
        <span class="comp-value kalshi-value">-</span>
      </div>
      <div class="comp-box" title="The current analyst consensus estimate retrieved directly from Nasdaq.com (powered by Zacks).">
        <span class="comp-label">Nasdaq Est (Zacks)</span>
        <span class="comp-value forecast">${nasdaq.epsForecast || '-'}</span>
      </div>
      <div class="comp-box">
        <span class="comp-label">Actual Reported</span>
        ${actualEpsHtml}
      </div>
    </div>
    
    <div class="card-odds-section">
      <div class="odds-header">
        <span class="odds-lbl-yes">YES (Beat) ${yesPercent}%</span>
        <span class="odds-lbl-no">NO (Miss) ${noPercent}%</span>
      </div>
      <div class="odds-track-bar">
        <div class="odds-fill-yes" style="width: ${yesPercent}%"></div>
      </div>
    </div>
  `;

  // Click handler to open detail drawer
  card.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-manual-eps') || e.target.closest('.btn-manual-eps')) {
      return; // Do not open drawer
    }
    openDetailDrawer(item);
  });

  // Click handler for ticker badge to open TradingView
  const tickerBadgeEl = card.querySelector('.ticker-badge');
  if (tickerBadgeEl) {
    tickerBadgeEl.title = "Click to view TradingView Candlestick Chart";
    tickerBadgeEl.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent drawer from opening
      window.open(`https://www.tradingview.com/symbols/${polymarket.ticker.toUpperCase()}/forecast/`, '_blank');
    });
  }

  // Click handler for manual EPS entry button
  const btnManual = card.querySelector('.btn-manual-eps');
  if (btnManual) {
    btnManual.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = prompt(`Enter actual reported EPS for ${polymarket.ticker} (e.g. 0.22):`);
      if (val !== null && val.trim() !== '') {
        const cleanVal = val.trim();
        nasdaq.eps = cleanVal.startsWith('$') ? cleanVal : `$${cleanVal}`;
        renderDashboard();
      }
    });
  }

  // Asynchronously fetch stock prices and update details
  updateCardPriceDetails(polymarket.ticker, card, polymarket.yesPrice, item);

  // Asynchronously fetch Kalshi active markets count to display badge
  updateCardKalshiBadge(polymarket.ticker, card, nasdaq.name);

  return card;
}

// Create Unmatched Card Element (Right Column)
function createUnmatchedCard(row) {
  const card = document.createElement('div');
  card.className = 'simple-card';

  const timeShort = getShortAnnounceTime(row.symbol, row.time);
  const timeFull = getDetailedAnnounceTime(row.symbol, row.time);

  let actualEpsHtml = '<span class="simple-val">-</span>';
  if (row.eps) {
    const estimate = parseFloat((row.epsForecast || '').replace('$', ''));
    const actual = parseFloat(row.eps.replace('$', ''));
    const isBeat = actual >= estimate;
    const statusClass = isBeat ? 'beat' : 'miss';
    actualEpsHtml = `<span class="simple-val actual ${statusClass}">${row.eps}</span>`;
  }

  card.innerHTML = `
    <div class="simple-header">
      <span class="simple-ticker">${row.symbol}</span>
      <span class="time-badge" title="Announcement time: ${timeFull}">${timeShort}</span>
    </div>
    <div class="simple-price-row">
      <span class="card-price-display simple-price">Loading price...</span>
    </div>
    <div class="simple-name-row">
      <span class="simple-name" title="Click to view TradingView Candlestick Chart">${row.name}</span>
      <a href="#" target="_blank" class="card-earnings-link hidden">
        Earnings
        <svg width="8" height="8" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="margin-left: 2px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
      </a>
    </div>
    <div class="simple-row">
      <span class="simple-label">Forecast:</span>
      <span class="simple-val forecast">${row.epsForecast || '-'}</span>
    </div>
    <div class="simple-row">
      <span class="simple-label">Actual:</span>
      ${actualEpsHtml}
    </div>
  `;

  // Click handler for ticker badge to open TradingView
  const simpleTickerEl = card.querySelector('.simple-ticker');
  if (simpleTickerEl) {
    simpleTickerEl.title = "Click to view TradingView Candlestick Chart";
    simpleTickerEl.addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(`https://www.tradingview.com/symbols/${row.symbol.toUpperCase()}/forecast/`, '_blank');
    });
  }

  // Asynchronously fetch simple card pricing
  updateSimpleCardPriceDetails(row.symbol, card);

  return card;
}

// Asynchronously load and update price details on a simple unmatched card
async function updateSimpleCardPriceDetails(ticker, cardElement) {
  const priceDisplay = cardElement.querySelector('.card-price-display');
  if (!priceDisplay) return;

  let data;
  if (priceHistoryCache[ticker]) {
    data = priceHistoryCache[ticker];
  } else {
    try {
      const res = await fetch(`/api/quote?symbol=${ticker}`);
      if (!res.ok) throw new Error('Fetch failed');
      const json = await res.json();
      const result = json.chart.result[0];
      const prices = result.indicators.quote[0].close;
      const currentPrice = result.meta.regularMarketPrice;
      const prevClose = result.meta.chartPreviousClose;

      // Calculate 2-week performance return (approx 10 trading days)
      let returnPct = 0;
      if (prices && prices.length >= 10) {
        const price10DaysAgo = prices[prices.length - 10] || prices[0];
        returnPct = ((currentPrice - price10DaysAgo) / price10DaysAgo) * 100;
      } else if (prices && prices.length > 0) {
        const startPrice = prices[0] || prevClose || currentPrice;
        returnPct = ((currentPrice - startPrice) / startPrice) * 100;
      }

      const relativeReturn = returnPct - (json.sectorEtfReturn || 0);

      data = {
        currentPrice,
        twoWeekReturn: returnPct,
        sector: json.sector,
        sectorEtf: json.sectorEtf,
        sectorEtfReturn: json.sectorEtfReturn,
        relativeReturn,
        googleExchange: json.googleExchange
      };
      priceHistoryCache[ticker] = data;
    } catch (e) {
      console.error(`Failed to load price details for simple card ${ticker}:`, e.message);
      priceDisplay.textContent = 'Price N/A';
      return;
    }
  }

  if (!data || typeof data.currentPrice !== 'number') {
    priceDisplay.textContent = 'Price N/A';
    return;
  }

  // Render price and return percentage with colored arrows
  const sign = data.twoWeekReturn >= 0 ? '+' : '';
  const returnClass = data.twoWeekReturn >= 0 ? 'delta-pos' : 'delta-neg';
  const arrow = data.twoWeekReturn >= 0 ? '▲' : '▼';
  
  const relSign = data.relativeReturn >= 0 ? '+' : '';
  const relClass = data.relativeReturn >= 0 ? 'delta-pos' : 'delta-neg';
  const sectorLabel = data.sectorEtf || 'Sector';

  priceDisplay.innerHTML = `<span class="price-val">$${data.currentPrice.toFixed(2)}</span> <span class="price-ret ${returnClass}" title="2-Week absolute stock performance return">${arrow} ${sign}${data.twoWeekReturn.toFixed(1)}%</span> <span class="price-ret ${relClass}" style="opacity: 0.85; font-size: 9px; font-weight: normal;" title="2-Week return relative to sector ETF ${sectorLabel}">${relSign}${data.relativeReturn.toFixed(1)}% vs ${sectorLabel}</span>`;

  // Update card earnings link once googleExchange is resolved
  const earningsLink = cardElement.querySelector('.card-earnings-link');
  if (earningsLink && data.googleExchange) {
    earningsLink.href = `https://www.google.com/finance/beta/quote/${ticker.toUpperCase()}:${data.googleExchange}?tab=earnings`;
    earningsLink.classList.remove('hidden');
    earningsLink.addEventListener('click', (e) => e.stopPropagation());
  }
}

// ==========================================================================
// DETAILS DRAWER INTERACTIVE OVERLAY
// ==========================================================================

function openDetailDrawer(item) {
  const { nasdaq, polymarket } = item;
  
  selectedTicker = polymarket.ticker; // Set currently selected ticker

  // Hide Kalshi comparison box in the drawer by default
  const drawerKalshiBox = document.getElementById('drawerKalshiBox');
  if (drawerKalshiBox) drawerKalshiBox.classList.add('hidden');

  // Hide Google Finance Earnings link in the drawer by default while loading
  const drawerEarningsLink = document.getElementById('drawerEarningsLink');
  if (drawerEarningsLink) drawerEarningsLink.classList.add('hidden');
  
  drawerTicker.textContent = polymarket.ticker;
  drawerCompany.textContent = nasdaq.name;
  drawerQuestion.textContent = polymarket.question;
  
  // Format YES/NO large labels
  drawerYesPrice.textContent = `${Math.round(polymarket.yesPrice * 100)}¢`;
  drawerNoPrice.textContent = `${Math.round(polymarket.noPrice * 100)}¢`;
  
  drawerTargetEps.textContent = polymarket.targetEps;
  drawerEpsType.textContent = polymarket.epsType;
  
  drawerForecastEps.textContent = nasdaq.epsForecast || '-';
  drawerNoOfEsts.textContent = nasdaq.noOfEsts ? `${nasdaq.noOfEsts} Analysts` : 'Nasdaq Est (Zacks)';
  
  // Actual Result
  if (nasdaq.eps) {
    drawerActualEps.textContent = nasdaq.eps;
    drawerActualEps.className = 'metric-value';
    if (nasdaq.surprise) {
      drawerSurprise.textContent = `Surprise: +${nasdaq.surprise}%`;
      drawerSurprise.className = 'metric-sub beat';
    } else {
      drawerSurprise.textContent = 'Surprise: 0.0%';
      drawerSurprise.className = 'metric-sub';
    }
    
    // Color code actual reported box based on Beat/Miss
    const estimate = parseFloat((nasdaq.epsForecast || '').replace('$', ''));
    const actual = parseFloat(nasdaq.eps.replace('$', ''));
    if (actual >= estimate) {
      drawerActualEps.classList.add('beat');
    } else {
      drawerActualEps.classList.add('miss');
      if (nasdaq.surprise) drawerSurprise.className = 'metric-sub miss';
    }
  } else if (polymarket.closed) {
    const isBeat = polymarket.yesPrice > 0.9;
    drawerActualEps.textContent = isBeat ? 'Beat' : 'Miss/Inline';
    drawerActualEps.className = `metric-value ${isBeat ? 'beat' : 'miss'}`;
    drawerSurprise.textContent = 'Resolved via Poly';
    drawerSurprise.className = 'metric-sub';
  } else {
    drawerActualEps.innerHTML = `- <button id="btnDrawerManualEps" title="Enter actual EPS manually" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size:12px; margin-left:4px; padding:0 2px; vertical-align:middle;">✎</button>`;
    drawerActualEps.className = 'metric-value';
    drawerSurprise.textContent = 'Surprise: -';
    drawerSurprise.className = 'metric-sub';
  }

  // Calculate and populate Strategic Assessment fields
  const delta = calculateDelta(polymarket.targetEps, nasdaq.epsForecast);
  if (delta) {
    drawerWhisperDelta.textContent = delta.text;
    if (delta.value > 0.01) {
      drawerWhisperDelta.className = 'assessment-val delta-pos';
    } else if (delta.value < -0.01) {
      drawerWhisperDelta.className = 'assessment-val delta-neg';
    } else {
      drawerWhisperDelta.className = 'assessment-val';
    }
  } else {
    drawerWhisperDelta.textContent = 'N/A';
    drawerWhisperDelta.className = 'assessment-val';
  }

  const signal = getSignalStrength(polymarket.volume);
  if (polymarket.closed) {
    drawerSignalStrength.textContent = 'Resolved';
    drawerSignalStrength.className = 'assessment-val signal-closed';
  } else {
    drawerSignalStrength.textContent = signal.rating;
    drawerSignalStrength.className = `assessment-val ${signal.class}`;
  }

  // Populate Stock Price details if available
  if (item.priceDetails) {
    updateDrawerPriceFields(item.priceDetails, item);
    loadSectorStats(item.priceDetails.sector, selectedDate);
  } else {
    drawerCurrentPrice.textContent = 'Loading...';
    drawerStockReturn.textContent = 'Loading...';
    drawerOpportunityRating.textContent = 'Loading...';
    drawer52WeekRange.textContent = 'Loading...';
    
    if (drawerSectorBeatLabel) drawerSectorBeatLabel.textContent = 'Sector Beat Rate';
    if (drawerSectorBeatRate) {
      drawerSectorBeatRate.textContent = 'Loading...';
      drawerSectorBeatRate.className = 'assessment-val';
    }
    if (drawerSectorBeatRatio) drawerSectorBeatRatio.textContent = 'Loading...';
    
    const drawerSectorReturn = document.getElementById('drawerSectorReturn');
    const drawerRelativeReturn = document.getElementById('drawerRelativeReturn');
    if (drawerSectorReturn) drawerSectorReturn.textContent = 'Loading...';
    if (drawerRelativeReturn) drawerRelativeReturn.textContent = 'Loading...';
    fetchPriceDetailsForDrawer(polymarket.ticker, item);
  }

  drawerStrategicAnalysis.innerHTML = getStrategicAnalysisText(
    polymarket.ticker, 
    delta, 
    signal, 
    polymarket.yesPrice,
    item.priceDetails
  );

  // Time
  drawerTime.textContent = getDetailedAnnounceTime(polymarket.ticker, nasdaq.time);

  // Description context
  drawerDescription.innerHTML = polymarket.description || 'No description context is currently provided for this contract.';

  // Links
  btnLinkPolymarket.href = `https://polymarket.com/event/${polymarket.slug}`;
  btnLinkNasdaq.href = `https://www.nasdaq.com/market-activity/stocks/${polymarket.ticker.toLowerCase()}/earnings`;

  // Dynamic Metrics Boxes Links
  const drawerTargetEpsLink = document.getElementById('drawerTargetEpsLink');
  const drawerForecastEpsLink = document.getElementById('drawerForecastEpsLink');
  if (drawerTargetEpsLink) {
    drawerTargetEpsLink.href = `https://polymarket.com/event/${polymarket.slug}`;
  }
  if (drawerForecastEpsLink) {
    drawerForecastEpsLink.href = `https://www.nasdaq.com/market-activity/stocks/${polymarket.ticker.toLowerCase()}/earnings`;
  }

  // Trigger Kalshi markets load
  loadKalshiMarkets(polymarket.ticker, nasdaq.name);

  // Display the drawer
  detailDrawer.classList.remove('hidden');

  // Click handler for drawer manual EPS entry
  const btnDrawerManual = document.getElementById('btnDrawerManualEps');
  if (btnDrawerManual) {
    btnDrawerManual.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = prompt(`Enter actual reported EPS for ${polymarket.ticker} (e.g. 0.22):`);
      if (val !== null && val.trim() !== '') {
        const cleanVal = val.trim();
        nasdaq.eps = cleanVal.startsWith('$') ? cleanVal : `$${cleanVal}`;
        renderDashboard();
        openDetailDrawer(item); // Refresh drawer
      }
    });
  }
}

function updateDrawerPriceFields(pd, item) {
  if (!pd || typeof pd.currentPrice !== 'number') {
    drawerCurrentPrice.textContent = 'Price N/A';
    drawerCurrentPrice.className = 'assessment-val';
    drawerStockReturn.textContent = 'N/A';
    drawerStockReturn.className = 'assessment-val';
    drawerOpportunityRating.textContent = 'N/A';
    drawerOpportunityRating.className = 'assessment-val';
    drawer52WeekRange.textContent = 'N/A';
    drawer52WeekRange.className = 'assessment-val';
    
    const drawerSectorReturn = document.getElementById('drawerSectorReturn');
    const drawerRelativeReturn = document.getElementById('drawerRelativeReturn');
    if (drawerSectorReturn) {
      drawerSectorReturn.textContent = 'N/A';
      drawerSectorReturn.className = 'assessment-val';
    }
    if (drawerRelativeReturn) {
      drawerRelativeReturn.textContent = 'N/A';
      drawerRelativeReturn.className = 'assessment-val';
    }
    return;
  }

  drawerCurrentPrice.textContent = `$${pd.currentPrice.toFixed(2)}`;
  drawerCurrentPrice.className = 'assessment-val';
  
  const sign = (pd.twoWeekReturn || 0) >= 0 ? '+' : '';
  drawerStockReturn.textContent = `${sign}${(pd.twoWeekReturn || 0).toFixed(2)}%`;
  drawerStockReturn.className = `assessment-val ${(pd.twoWeekReturn || 0) >= 0 ? 'delta-pos' : 'delta-neg'}`;
  
  const drawerSectorReturnLabel = document.getElementById('drawerSectorReturnLabel');
  const drawerSectorReturn = document.getElementById('drawerSectorReturn');
  const drawerRelativeReturn = document.getElementById('drawerRelativeReturn');

  if (drawerSectorReturnLabel && pd.sectorEtf) {
    drawerSectorReturnLabel.textContent = `Sector Return (${pd.sectorEtf})`;
  }
  if (drawerSectorReturn) {
    const etfSign = (pd.sectorEtfReturn || 0) >= 0 ? '+' : '';
    drawerSectorReturn.textContent = `${etfSign}${(pd.sectorEtfReturn || 0).toFixed(2)}%`;
    drawerSectorReturn.className = `assessment-val ${(pd.sectorEtfReturn || 0) >= 0 ? 'delta-pos' : 'delta-neg'}`;
  }
  if (drawerRelativeReturn) {
    const relSign = (pd.relativeReturn || 0) >= 0 ? '+' : '';
    drawerRelativeReturn.textContent = `${relSign}${(pd.relativeReturn || 0).toFixed(2)}%`;
    drawerRelativeReturn.className = `assessment-val ${(pd.relativeReturn || 0) >= 0 ? 'delta-pos' : 'delta-neg'}`;
  }

  const drawerEarningsLink = document.getElementById('drawerEarningsLink');
  if (drawerEarningsLink && pd.googleExchange) {
    drawerEarningsLink.href = `https://www.google.com/finance/beta/quote/${item.polymarket.ticker.toUpperCase()}:${pd.googleExchange}?tab=earnings`;
    drawerEarningsLink.classList.remove('hidden');
  }

  drawerOpportunityRating.textContent = pd.rating ? pd.rating.replace('⚡ ', '').replace('⚠️ ', '') : 'Aligned';
  drawerOpportunityRating.className = `assessment-val ${pd.ratingClass || 'opp-neutral'}`;
  
  let positionNote = '';
  const posVal = typeof pd.fiftyTwoWeekPos === 'number' ? pd.fiftyTwoWeekPos : 50;
  if (posVal >= 70) positionNote = ' (Near High)';
  else if (posVal <= 30) positionNote = ' (Near Low)';
  else positionNote = ' (Mid-Range)';
  drawer52WeekRange.textContent = `${posVal.toFixed(0)}%${positionNote}`;
  drawer52WeekRange.className = 'assessment-val';

  // Recalculate analysis content with the loaded price
  const delta = calculateDelta(item.polymarket.targetEps, item.nasdaq.epsForecast);
  const signal = getSignalStrength(item.polymarket.volume);
  drawerStrategicAnalysis.innerHTML = getStrategicAnalysisText(
    item.polymarket.ticker, 
    delta, 
    signal, 
    item.polymarket.yesPrice,
    pd
  );
}

async function fetchPriceDetailsForDrawer(ticker, item) {
  try {
    const res = await fetch(`/api/quote?symbol=${ticker}`);
    if (!res.ok) throw new Error('Fetch failed');
    const json = await res.json();
    const result = json.chart.result[0];
    const prices = result.indicators.quote[0].close;
    const currentPrice = result.meta.regularMarketPrice;
    const prevClose = result.meta.chartPreviousClose;
    const high = result.meta.fiftyTwoWeekHigh;
    const low = result.meta.fiftyTwoWeekLow;

    let returnPct = 0;
    if (prices && prices.length >= 10) {
      const price10DaysAgo = prices[prices.length - 10] || prices[0];
      returnPct = ((currentPrice - price10DaysAgo) / price10DaysAgo) * 100;
    } else if (prices && prices.length > 0) {
      const startPrice = prices[0] || prevClose || currentPrice;
      returnPct = ((currentPrice - startPrice) / startPrice) * 100;
    }

    let rangePos = 50;
    if (high > low) {
      rangePos = ((currentPrice - low) / (high - low)) * 100;
    }

    const relativeReturn = returnPct - (json.sectorEtfReturn || 0);

    let rating = 'Aligned / Mixed';
    let ratingClass = 'opp-neutral';
    
    const yesPrice = item.polymarket.yesPrice;
    if (yesPrice >= 0.70) {
      if (relativeReturn <= 3.0) {
        rating = '⚡ Opportunity (Flat/Down)';
        ratingClass = 'opp-high';
      } else if (relativeReturn >= 7.5) {
        rating = '⚠️ Likely Priced In';
        ratingClass = 'opp-priced-in';
      }
    }

    const data = {
      currentPrice,
      prevClose,
      twoWeekReturn: returnPct,
      fiftyTwoWeekHigh: high,
      fiftyTwoWeekLow: low,
      fiftyTwoWeekPos: rangePos,
      prices,
      sector: json.sector,
      industry: json.industry,
      sectorEtf: json.sectorEtf,
      sectorEtfReturn: json.sectorEtfReturn,
      relativeReturn,
      rating,
      ratingClass,
      googleExchange: json.googleExchange
    };

    priceHistoryCache[ticker] = data;
    item.priceDetails = data;

    if (selectedTicker === ticker && detailDrawer && !detailDrawer.classList.contains('hidden')) {
      updateDrawerPriceFields(data, item);
      loadSectorStats(data.sector, selectedDate);
    }
  } catch (e) {
    console.error('Drawer price fetch failed:', e.message);
  }
}

async function loadSectorStats(sector, date) {
  if (!drawerSectorBeatLabel || !drawerSectorBeatRate || !drawerSectorBeatRatio) return;
  
  if (!sector) {
    drawerSectorBeatLabel.textContent = 'Sector Beat Rate';
    drawerSectorBeatRate.textContent = 'N/A';
    drawerSectorBeatRate.className = 'assessment-val';
    drawerSectorBeatRatio.textContent = 'N/A';
    return;
  }
  
  drawerSectorBeatLabel.textContent = `${sector} Beat Rate`;
  drawerSectorBeatRate.textContent = 'Loading...';
  drawerSectorBeatRatio.textContent = 'Loading...';
  
  try {
    const res = await fetch(`/api/sector-stats?sector=${encodeURIComponent(sector)}&date=${date}`);
    if (!res.ok) throw new Error('Fetch sector stats failed');
    const data = await res.json();
    
    drawerSectorBeatRate.textContent = `${data.beatRate.toFixed(1)}%`;
    drawerSectorBeatRatio.textContent = `${data.beats} / ${data.totalReports}`;
    
    if (data.beatRate >= 65.0) {
      drawerSectorBeatRate.className = 'assessment-val delta-pos';
    } else if (data.beatRate <= 45.0) {
      drawerSectorBeatRate.className = 'assessment-val delta-neg';
    } else {
      drawerSectorBeatRate.className = 'assessment-val';
    }
  } catch (err) {
    console.error('Failed to load sector stats:', err);
    drawerSectorBeatRate.textContent = 'Error';
    drawerSectorBeatRate.className = 'assessment-val';
    drawerSectorBeatRatio.textContent = 'Error';
  }
}

async function loadKalshiMarkets(ticker, companyName) {
  const container = document.getElementById('drawerKalshiContainer');
  if (!container) return;

  // Show loading spinner
  container.innerHTML = `
    <div class="loader-container inline-loader">
      <div class="spinner mini"></div>
      <p>Checking Kalshi word mention markets...</p>
    </div>
  `;

  try {
    const res = await fetch(`/api/kalshi?ticker=${ticker}&company=${encodeURIComponent(companyName)}`);
    if (!res.ok) throw new Error('API server returned error');
    const data = await res.json();

    // Update comparison box in the drawer if available
    const drawerKalshiBox = document.getElementById('drawerKalshiBox');
    const drawerKalshiValue = document.getElementById('drawerKalshiValue');
    if (drawerKalshiBox && drawerKalshiValue && data.markets && data.markets.length > 0) {
      drawerKalshiValue.textContent = `${data.markets.length} Words`;
      drawerKalshiBox.classList.remove('hidden');
    }

    // Verify if the drawer is still open for the same ticker
    if (drawerTicker.textContent !== ticker) {
      return; // User has switched to another company or closed the drawer
    }

    container.innerHTML = '';

    if (!data.markets || data.markets.length === 0) {
      container.innerHTML = `
        <div class="kalshi-empty">
          No active Kalshi word mention contracts found for ${ticker}.
        </div>
      `;
      return;
    }

    // Render each market card
    data.markets.forEach(m => {
      const card = document.createElement('div');
      card.className = 'kalshi-market-card';

      // Target word is in yes_sub_title (often) or extracted from custom_strike
      const word = m.yes_sub_title || (m.custom_strike ? m.custom_strike.Word : '') || 'Mention';

      // Calculate probability
      const lastPrice = parseFloat(m.last_price_dollars);
      let prob = 50; // default
      if (!isNaN(lastPrice)) {
        prob = Math.round(lastPrice * 100);
      } else {
        const yesAsk = parseFloat(m.yes_ask_dollars);
        const yesBid = parseFloat(m.yes_bid_dollars);
        if (!isNaN(yesAsk) && !isNaN(yesBid)) {
          prob = Math.round(((yesAsk + yesBid) / 2) * 100);
        } else if (!isNaN(yesBid)) {
          prob = Math.round(yesBid * 100);
        } else if (!isNaN(yesAsk)) {
          prob = Math.round(yesAsk * 100);
        }
      }

      const probText = `${prob}%`;

      card.innerHTML = `
        <div class="kalshi-word-badge">${word}</div>
        <div class="kalshi-probability-row">
          <span>Probability of Mention</span>
          <span class="kalshi-prob-val">${probText}</span>
        </div>
        <div class="kalshi-prob-track">
          <div class="kalshi-prob-fill" style="width: ${prob}%"></div>
        </div>
        <div class="kalshi-card-footer">
          <a href="https://kalshi.com/markets/${m.ticker.toLowerCase()}" target="_blank" class="btn-kalshi-link">
            Trade on Kalshi 
            <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
          </a>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error(`Error loading Kalshi markets for ${ticker}:`, err);
    if (drawerTicker.textContent === ticker) {
      container.innerHTML = `
        <div class="kalshi-empty">
          Failed to load Kalshi markets. Please try again.
        </div>
      `;
    }
  }
}

function closeDetailDrawer() {
  detailDrawer.classList.add('hidden');
}

// ==========================================================================
// SYSTEM EVENT LISTENERS
// ==========================================================================

async function changeDate(newDate) {
  if (!newDate) return;
  selectedDate = newDate;
  datePicker.value = selectedDate;
  displayDate.textContent = formatDateForDisplay(selectedDate);
  
  // Reload Nasdaq data for the new date, then match
  await fetchNasdaqData(selectedDate);
  renderDashboard();
}

// Initialize Application
async function init() {
  // Set initial date picker value
  datePicker.value = selectedDate;
  displayDate.textContent = formatDateForDisplay(selectedDate);

  // Setup Event listeners
  datePicker.addEventListener('change', (e) => {
    changeDate(e.target.value);
  });

  btnPrevDay.addEventListener('click', () => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() - 1);
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    changeDate(`${yyyy}-${mm}-${dd}`);
  });

  btnNextDay.addEventListener('click', () => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() + 1);
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    changeDate(`${yyyy}-${mm}-${dd}`);
  });

  // Toggle strategy guide visibility
  btnToggleStrategy.addEventListener('click', () => {
    strategyContent.classList.toggle('hidden');
    strategyIndicator.classList.toggle('expanded');
  });

  searchBar.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderDashboard();
  });

  closeDrawer.addEventListener('click', closeDetailDrawer);

  // Click handler for drawer ticker badge to open TradingView
  const drawerTickerEl = document.getElementById('drawerTicker');
  if (drawerTickerEl) {
    drawerTickerEl.title = "Click to view TradingView Candlestick Chart";
    drawerTickerEl.addEventListener('click', () => {
      const symbol = drawerTickerEl.textContent;
      if (symbol && symbol !== 'TICKER') {
        window.open(`https://www.tradingview.com/symbols/${symbol.toUpperCase()}/forecast/`, '_blank');
      }
    });
  }
  
  // Close drawer if clicking overlay background
  detailDrawer.addEventListener('click', (e) => {
    if (e.target === detailDrawer) {
      closeDetailDrawer();
    }
  });

  // Initial Fetches (Fetch Polymarket once, Nasdaq for today's date)
  await Promise.all([
    fetchPolymarketData(),
    fetchNasdaqData(selectedDate)
  ]);

  renderDashboard();
}

// Run init on load
document.addEventListener('DOMContentLoaded', init);
