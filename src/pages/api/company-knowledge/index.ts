import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/pg-db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      // First check if table exists
      // In PostgreSQL, we can just try to query and handle any errors
      // The table is created during initialization, so it should always exist
      
      const result = await query(`
        SELECT id, category, filename, original_filename, uploaded_at 
        FROM company_knowledge 
        ORDER BY category, uploaded_at DESC
      `);
      
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching knowledge files:', error);
      res.status(200).json([]); // Return empty array instead of error
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}