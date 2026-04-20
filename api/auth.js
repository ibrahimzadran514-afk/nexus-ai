// api/auth.js — Password authentication endpoint
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;
  const correctPassword = process.env.ACCESS_PASSWORD;

  if (!correctPassword) {
    // If no password is set, allow access (for first-time setup)
    return res.status(200).json({ ok: true });
  }

  if (password === correctPassword) {
    return res.status(200).json({ ok: true });
  } else {
    return res.status(401).json({ error: 'Invalid password' });
  }
}
