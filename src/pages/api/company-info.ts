import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/pg-db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const result = await query('SELECT * FROM company_info LIMIT 1');
      res.json(result.rows[0] || null);
    } catch (error) {
      console.error('Failed to fetch company info:', error);
      res.status(500).json({ error: 'Failed to fetch company info' });
    }
  } else if (req.method === 'POST') {
    try {
      const {
        company_name,
        description,
        services,
        capabilities,
        differentiators,
        experience,
        certifications,
        team_size,
        website,
        email,
        phone,
        address,
      } = req.body;

      // Check if company info exists
      const existingResult = await query('SELECT id FROM company_info LIMIT 1');
      const existing = existingResult.rows[0];

      if (existing) {
        // Update existing record
        await query(
          `UPDATE company_info SET 
            company_name = $1,
            description = $2,
            services = $3,
            capabilities = $4,
            differentiators = $5,
            experience = $6,
            certifications = $7,
            team_size = $8,
            website = $9,
            email = $10,
            phone = $11,
            address = $12,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $13`,
          [company_name,
          description,
          services,
          capabilities,
          differentiators,
          experience,
          certifications,
          team_size,
          website,
          email,
          phone,
          address,
          existing.id]
        );
      } else {
        // Create new record
        await query(
          `INSERT INTO company_info (
            company_name,
            description,
            services,
            capabilities,
            differentiators,
            experience,
            certifications,
            team_size,
            website,
            email,
            phone,
            address
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [company_name,
          description,
          services,
          capabilities,
          differentiators,
          experience,
          certifications,
          team_size,
          website,
          email,
          phone,
          address]
        );
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to save company info:', error);
      res.status(500).json({ error: 'Failed to save company info' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}