import type { NextApiRequest, NextApiResponse } from 'next';
import { query, pool } from '@/lib/pg-db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { questions } = req.body;

  if (!id || typeof id !== 'string' || !questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const question of questions) {
      await client.query(
        'UPDATE rfi_questions SET position = $1, order_index = $2 WHERE id = $3 AND project_id = $4',
        [question.order_index, question.order_index, question.id, id]
      );
    }

    await client.query('COMMIT');
    res.status(200).json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to reorder questions' });
  } finally {
    client.release();
  }
}