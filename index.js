const express = require("express");
const { google } = require("googleapis");
const keys = require("./applied-radar-438418-i8-52fac32564fe.json");
const app = express();

const PORT = process.env.PORT || 3000;

const spreadsheetId = "1V7sG1uu7GZw7T2UNjXs2h3wbc4Td2FM-iiwNnY8rD4A";
const sheetName = "secret_codes";

app.get("/validate", async (req, res) => {
  const { product_id, secret_code } = req.query;

  if (!product_id || !secret_code) {
    return res.status(400).json({ status: "error", message: "Missing parameters" });
  }

  try {
    const client = new google.auth.JWT(
      keys.client_email,
      null,
      keys.private_key,
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    await client.authorize();

    const sheets = google.sheets({ version: "v4", auth: client });

    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: sheetName,
    });

    const rows = readRes.data.values;

    const header = rows[0];
    const productIdIndex = header.indexOf("product_id");
    const secretCodeIndex = header.indexOf("secret_code");
    const statusIndex = header.indexOf("Status");
    const dateUsedIndex = header.indexOf("Date Used");

    const matchedRowIndex = rows.findIndex((row, i) => {
      if (i === 0) return false;
      return row[productIdIndex] === product_id && row[secretCodeIndex] === secret_code;
    });

    if (matchedRowIndex === -1) {
      return res.status(404).json({ status: "error", message: "Code not found" });
    }

    if (rows[matchedRowIndex][statusIndex] === "USED") {
      return res.status(400).json({ status: "error", message: "Code already used" });
    }

    const now = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!C${matchedRowIndex + 1}:D${matchedRowIndex + 1}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [["USED", now]],
      },
    });

    return res.json({ status: "success", message: "Code is valid and marked as used" });

  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
