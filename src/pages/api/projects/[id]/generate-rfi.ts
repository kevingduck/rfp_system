import type { NextApiRequest, NextApiResponse } from 'next';
import { RFIGenerator } from '@/lib/rfi-generator';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { chatContext } = req.body || {};

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  try {
    const generator = new RFIGenerator(id);
    const docBuffer = await generator.generateRFI(chatContext);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="RFI_${id}.docx"`);
    res.send(docBuffer);
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: 'Failed to generate RFI' });
  }
}