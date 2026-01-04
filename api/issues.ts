
import { sql } from './_db';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { userEmail, userRole } = req.query;

      if (!userEmail || !userRole) {
        return res.status(400).json({ message: 'User information is required.' });
      }

      let rows;
      if (userRole === 'Admin' || userRole === 'Owner') {
        rows = await sql`SELECT * FROM "AI_Agent".reported_issues ORDER BY created_at DESC`;
      } else {
        rows = await sql`SELECT * FROM "AI_Agent".reported_issues WHERE raised_by_email = ${userEmail as string} ORDER BY created_at DESC`;
      }
      
      const issues = rows.map(r => ({
          id: r.id,
          description: r.description,
          raised_by_email: r.raised_by_email,
          created_at: new Date(r.created_at).getTime(),
          status: r.status,
          updated_at: r.updated_at ? new Date(r.updated_at).getTime() : null,
          updated_by_email: r.updated_by_email
      }));

      return res.status(200).json(issues);
    }

    if (req.method === 'PUT') {
      const { issueId, newStatus, updaterEmail, updaterRole } = req.body;
      
      if (!issueId || !newStatus || !updaterEmail || !updaterRole) {
        return res.status(400).json({ message: 'Missing required fields for update.' });
      }

      const [issue] = await sql`SELECT * FROM "AI_Agent".reported_issues WHERE id = ${issueId as string}::UUID`;
      if (!issue) {
        return res.status(404).json({ message: 'Issue not found.' });
      }

      let canUpdate = false;
      // Admin/Owner can change Pending <-> Resolved
      if ((updaterRole === 'Admin' || updaterRole === 'Owner') && (newStatus === 'Pending' || newStatus === 'Resolved')) {
        canUpdate = true;
      }
      // User can revoke their own pending issue
      if (updaterRole === 'User' && newStatus === 'Revoked' && issue.raised_by_email === updaterEmail && issue.status === 'Pending') {
        canUpdate = true;
      }
      
      if (!canUpdate) {
        return res.status(403).json({ message: 'You do not have permission to perform this action.' });
      }
      
      await sql`
        UPDATE "AI_Agent".reported_issues 
        SET status = ${newStatus}, updated_at = NOW(), updated_by_email = ${updaterEmail} 
        WHERE id = ${issueId as string}::UUID
      `;
      
      return res.status(200).json({ message: 'Issue status updated successfully.' });
    }

    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });

  } catch (error) {
    console.error('Issues API Error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
