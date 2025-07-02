import { NextApiRequest, NextApiResponse } from 'next';
import { ConvergedNetworksScraper } from '@/lib/converged-scraper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url || url !== 'https://www.convergednetworks.com') {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    console.log('[Company Import] Starting comprehensive import from Converged Networks website');
    
    const scraper = new ConvergedNetworksScraper();
    const companyData = await scraper.scrapeCompanyInfo();

    console.log('[Company Import] Successfully extracted company data');
    res.status(200).json(companyData);
  } catch (error) {
    console.error('[Company Import] Error:', error);
    res.status(500).json({ error: 'Failed to import company information' });
  }
}