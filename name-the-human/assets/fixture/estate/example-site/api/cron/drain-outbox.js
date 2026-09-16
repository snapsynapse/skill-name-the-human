// Synthetic fixture. Sends whatever queued email the site produced overnight.
export default async function handler(req, res) {
  const key = process.env.RESEND_API_KEY;
  const rows = await readOutbox();
  for (const row of rows) await send(row, key);
  res.status(200).json({ sent: rows.length });
}
