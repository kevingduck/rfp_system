import type { NextApiRequest, NextApiResponse } from 'next';
import { openDb } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { questions } = req.body;

  if (!id || typeof id !== 'string' || !questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const db = await openDb();

  try {
    await db.run('BEGIN TRANSACTION');

    for (const question of questions) {
      await db.run(
        'UPDATE rfi_questions SET position = ?, order_index = ? WHERE id = ? AND project_id = ?',
        [question.order_index, question.order_index, question.id, id]
      );
    }

    await db.run('COMMIT');
    res.status(200).json({ success: true });
  } catch (error) {
    await db.run('ROLLBACK');
    res.status(500).json({ error: 'Failed to reorder questions' });
  }
}