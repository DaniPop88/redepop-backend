const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();
app.use(cors());
app.use(express.json());

const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
const spreadsheetId = "1V7sG1uu7GZw7T2UNjXs2h3wbc4Td2FM-iiwNnY8rD4A";

async function authorizeSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return await auth.getClient();
}

app.get("/", (req, res) => {
  res.send("✅ BACKEND IS RUNNING!!");
});

app.get("/validate", async (req, res) => {
  const { product_id, secret_code } = req.query;

  if (!product_id || !secret_code) {
    return res.status(400).json({ status: "error", message: "Missing data" });
  }

  try {
    const authClient = await authorizeSheets();
    const sheets = google.sheets({ version: "v4", auth: authClient });

    const read = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "secret_codes", // Ubah jika Sheet kamu bukan Sheet1
    });

    const rows = read.data.values;
    if (!rows || rows.length === 0) {
      return res.json({ status: "error", message: "Sheet kosong" });
    }

    const found = rows.find(
      (row) =>
        row[0] === product_id.trim() &&
        row[1] === secret_code.trim()
    );

    if (found) {
      return res.json({ status: "valid", message: "Code valid" });
    } else {
      return res.json({ status: "invalid", message: "Code tidak ditemukan" });
    }
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server ready on port ${PORT}`);
});
