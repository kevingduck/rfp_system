import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/pg-db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, questionId } = req.query;

  if (!id || !questionId || typeof id !== 'string' || typeof questionId !== 'string') {
    return res.status(400).json({ error: 'Invalid project or question ID' });
  }

  switch (req.method) {
    case 'DELETE':
      try {
        await query(
          'DELETE FROM rfi_questions WHERE id = $1 AND project_id = $2',
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

        await query(
          `UPDATE rfi_questions 
           SET question_text = $1, question_type = $2, required = $3, category = $4
           WHERE id = $5 AND project_id = $6`,
          [question_text, question_type, required, category, questionId, id]
        );

        const questionResult = await query(
          'SELECT * FROM rfi_questions WHERE id = $1',
          [questionId]
        );
        const question = questionResult.rows[0];

        res.status(200).json(question);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update question' });
      }
      break;

    default:
      res.status(405).json({ error: 'Method not allowed' });
  }
}