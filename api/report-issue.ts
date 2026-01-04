
import { sql } from './_db';
import { randomUUID } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { issueDescription, userEmail } = req.body;

    if (!issueDescription || !userEmail) {
      return res.status(400).json({ message: 'Issue description and user email are required.' });
    }
    
    const sanitizedDescription = issueDescription.trim();
    if (sanitizedDescription.length === 0) {
      return res.status(400).json({ message: 'Issue description cannot be empty.' });
    }

    // Save issue to database
    const issueId = randomUUID();
    await sql`
      INSERT INTO "AI_Agent".reported_issues (id, description, raised_by_email, status)
      VALUES (${issueId}, ${sanitizedDescription}, ${userEmail}, 'Pending')
    `;

    return res.status(200).json({ message: 'Issue reported successfully.' });

  } catch (error) {
    console.error('Report Issue API Error:', error);
    return res.status(500).json({ message: 'Internal Server Error while reporting issue.' });
  }
}
