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
        spin_number,
        tax_id,
        fcc_registration,
        contact_name,
        contact_title,
        contact_email,
        contact_phone,
        erate_experience,
        erate_funding_secured,
        districts_served,
        years_in_business,
        key_personnel,
        client_references,
        founded_year,
        headquarters,
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
            spin_number = $13,
            tax_id = $14,
            fcc_registration = $15,
            contact_name = $16,
            contact_title = $17,
            contact_email = $18,
            contact_phone = $19,
            erate_experience = $20,
            erate_funding_secured = $21,
            districts_served = $22,
            years_in_business = $23,
            key_personnel = $24,
            client_references = $25,
            founded_year = $26,
            headquarters = $27,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $28`,
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
          spin_number,
          tax_id,
          fcc_registration,
          contact_name,
          contact_title,
          contact_email,
          contact_phone,
          erate_experience,
          erate_funding_secured,
          districts_served,
          years_in_business,
          key_personnel,
          client_references,
          founded_year,
          headquarters,
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
            address,
            spin_number,
            tax_id,
            fcc_registration,
            contact_name,
            contact_title,
            contact_email,
            contact_phone,
            erate_experience,
            erate_funding_secured,
            districts_served,
            years_in_business,
            key_personnel,
            client_references,
            founded_year,
            headquarters
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)`,
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
          spin_number,
          tax_id,
          fcc_registration,
          contact_name,
          contact_title,
          contact_email,
          contact_phone,
          erate_experience,
          erate_funding_secured,
          districts_served,
          years_in_business,
          key_personnel,
          client_references,
          founded_year,
          headquarters]
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