import type { NextApiRequest, NextApiResponse } from 'next';
import { openDb } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, questionId } = req.query;

  if (!id || !questionId || typeof id !== 'string' || typeof questionId !== 'string') {
    return res.status(400).json({ error: 'Invalid project or question ID' });
  }

  const db = await openDb();

  switch (req.method) {
    case 'DELETE':
      try {
        await db.run(
          'DELETE FROM rfi_questions WHERE id = ? AND project_id = ?',
          [questionId, id]
        );
        res.status(200).json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete question' });
      }
      break;

    case 'PUT':
      try {
        const { question_text, question_type, required, category } = req.body;

        await db.run(
          `UPDATE rfi_questions 
           SET question_text = ?, question_type = ?, required = ?, category = ?
           WHERE id = ? AND project_id = ?`,
          [question_text, question_type, required ? 1 : 0, category, questionId, id]
        );

        const question = await db.get(
          'SELECT * FROM rfi_questions WHERE id = ?',
          questionId
        );

        res.status(200).json(question);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update question' });
      }
      break;

    default:
      res.status(405).json({ error: 'Method not allowed' });
  }
}