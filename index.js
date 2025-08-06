import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxt177cEOKIfKlMHdXTQ7KgSMIG5dboL55wz1crjPJWst8c281pikc0Ef5nWTPV9nUKiQ/exec';

// Proxy GET (for validateCode)
app.get('/validate', async (req, res) => {
  const query = new URLSearchParams(req.query).toString();
  const url = `${GOOGLE_SCRIPT_URL}?action=validateCode&${query}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Proxy POST (for marking code as used)
app.post('/submit', async (req, res) => {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
