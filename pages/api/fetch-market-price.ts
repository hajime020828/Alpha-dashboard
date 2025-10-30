// pages/api/fetch-market-price.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type MarketDataResponse = {
    ticker: string;
    price: number | null;
    allDayVWAP: number | null;
    chgPct1d: number | null; // ★ 1日% (CHG_PCT_1D) を追加
} | {
    error: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MarketDataResponse>
) {
  const { ticker } = req.query;

  if (typeof ticker !== 'string' || !ticker) {
    return res.status(400).json({ error: 'Ticker query parameter is required and must be a string.' });
  }

  try {
    // ★ fields に CHG_PCT_1D を追加
    const flaskApiUrl = `http://localhost:5001/api/reference_data?ticker=${encodeURIComponent(ticker)}&fields=PX_LAST,ALL_DAY_VWAP,CHG_PCT_1D`;
    
    console.log(`Fetching market data from Flask API: ${flaskApiUrl}`);
    const marketDataRes = await fetch(flaskApiUrl);

    if (!marketDataRes.ok) {
      const errorData = await marketDataRes.json().catch(() => ({ error: "Failed to parse error response from Flask API" }));
      console.error(`Error from Flask API: ${marketDataRes.status}`, errorData);
      return res.status(marketDataRes.status).json({ error: `Failed to fetch market data from backend service: ${errorData.error || marketDataRes.statusText}` });
    }

    const data: any[] = await marketDataRes.json();
    console.log('Received data from Flask API for market data:', data);
    
    if (Array.isArray(data) && data.length > 0) {
      const securityData = data[0];
      if (securityData && typeof securityData.security === 'string') {
        
        const price = typeof securityData.PX_LAST === 'number' ? securityData.PX_LAST : null;
        const allDayVWAP = typeof securityData.ALL_DAY_VWAP === 'number' ? securityData.ALL_DAY_VWAP : null;
        const chgPct1d = typeof securityData.CHG_PCT_1D === 'number' ? securityData.CHG_PCT_1D : null; // ★ 追加

        // 個別のフィールドエラーも確認
        if (typeof securityData.PX_LAST === 'string' && securityData.PX_LAST.startsWith("Field Error:")) {
            console.error(`Field error for PX_LAST on ${ticker}: ${securityData.PX_LAST}`);
        }
        if (typeof securityData.ALL_DAY_VWAP === 'string' && securityData.ALL_DAY_VWAP.startsWith("Field Error:")) {
            console.error(`Field error for ALL_DAY_VWAP on ${ticker}: ${securityData.ALL_DAY_VWAP}`);
        }
        if (typeof securityData.CHG_PCT_1D === 'string' && securityData.CHG_PCT_1D.startsWith("Field Error:")) { // ★ 追加
            console.error(`Field error for CHG_PCT_1D on ${ticker}: ${securityData.CHG_PCT_1D}`);
        }
        
        if (securityData.securityError) {
             return res.status(404).json({ error: securityData.securityError });
        }
        
        return res.status(200).json({ 
            ticker: securityData.security, 
            price: price,
            allDayVWAP: allDayVWAP,
            chgPct1d: chgPct1d // ★ 追加
        });

      }
    }
    
    console.error("Unexpected response format from Flask API or no data:", data);
    return res.status(500).json({ error: "Unexpected response format from Flask API or no data found" });

  } catch (error: any) {
    console.error('Error fetching market data in Next.js API route:', error);
    return res.status(500).json({ error: error.message || 'Internal server error in Next.js API route' });
  }
}