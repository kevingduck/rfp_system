import type { NextApiRequest, NextApiResponse } from 'next';
import { openDb } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = await openDb();

  if (req.method === 'GET') {
    try {
      const companyInfo = await db.get('SELECT * FROM company_info LIMIT 1');
      res.json(companyInfo || null);
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
      const existing = await db.get('SELECT id FROM company_info LIMIT 1');

      if (existing) {
        // Update existing record
        await db.run(
          `UPDATE company_info SET 
            company_name = ?,
            description = ?,
            services = ?,
            capabilities = ?,
            differentiators = ?,
            experience = ?,
            certifications = ?,
            team_size = ?,
            website = ?,
            email = ?,
            phone = ?,
            address = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
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
          existing.id
        );
      } else {
        // Create new record
        const id = Math.random().toString(36).substr(2, 9);
        await db.run(
          `INSERT INTO company_info (
            id,
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
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          id,
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