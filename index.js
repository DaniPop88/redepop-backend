import express from "express";
import cors from "cors";
import { google } from "googleapis";

const app = express();
app.use(cors());
app.use(express.json());

// 👉 AUTH 1: For validating secret codes
const creds1 = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_1);
const spreadsheetId1 = process.env.SPREADSHEET_ID_1;

// 👉 AUTH 2: For saving order
const creds2 = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_2);
const spreadsheetId2 = process.env.SPREADSHEET_ID_2;

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

// 📝 Save order to ORDER sheet
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

  try {
    const sheets = await getSheetsClient(creds2);
    const timestamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const values = [
      [
        timestamp,    // A: Timestamp
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

    await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId2,
      range: "ORDER!A2", // Pastikan Sheet namanya benar
      valueInputOption: "USER_ENTERED",
      resource: { values },
    });

    return res.json({ status: "success", message: "Order saved" });
  } catch (err) {
    console.error("Error in /order:", err);
    return res.status(500).json({ status: "error", message: "Failed to save order" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server ready on port ${PORT}`);
});
