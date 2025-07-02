import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';
import { openDb } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const db = await openDb();

  switch (req.method) {
    case 'GET':
      try {
        const questions = await db.all(
          'SELECT * FROM rfi_questions WHERE project_id = ? ORDER BY position, category',
          [id]
        );
        res.status(200).json(questions);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch questions' });
      }
      break;

    case 'POST':
      try {
        const { question_text, question_type = 'text', required = true, order_index, category } = req.body;

        if (!question_text) {
          return res.status(400).json({ error: 'Question text is required' });
        }

        const questionId = uuidv4();
        const position = order_index || 0;
        await db.run(
          `INSERT INTO rfi_questions (id, project_id, question_text, question_type, required, position, order_index, category)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [questionId, id, question_text, question_type, required ? 1 : 0, position, position, category]
        );

        const question = await db.get(
          'SELECT * FROM rfi_questions WHERE id = ?',
          [questionId]
        );

        res.status(201).json(question);
      } catch (error) {
        res.status(500).json({ error: 'Failed to create question' });
      }
      break;

    default:
      res.status(405).json({ error: 'Method not allowed' });
  }
}