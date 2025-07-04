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
        const { question_text, question_type, required, category, answer } = req.body;

        // If only answer is provided, update just the answer
        if (answer !== undefined && !question_text) {
          await query(
            `UPDATE rfi_questions 
             SET answer = $1
             WHERE id = $2 AND project_id = $3`,
            [answer, questionId, id]
          );
        } else {
          // Update all fields
          await query(
            `UPDATE rfi_questions 
             SET question_text = COALESCE($1, question_text), 
                 question_type = COALESCE($2, question_type), 
                 required = COALESCE($3, required), 
                 category = COALESCE($4, category),
                 answer = COALESCE($5, answer)
             WHERE id = $6 AND project_id = $7`,
            [question_text, question_type, required, category, answer, questionId, id]
          );
        }

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