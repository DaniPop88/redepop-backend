const express = require("express");
const app = express();
const cors = require("cors");

app.use(cors());
app.use(express.json());

// TEST ROUTE
app.get("/", (req, res) => {
  res.send("Backend aktif! 👍");
});

// VALIDATION ENDPOINT
app.get("/validate", (req, res) => {
  const { product_id, secret_code } = req.query;

  if (!product_id || !secret_code) {
    return res.status(400).json({
      status: "error",
      message: "Missing product_id or secret_code",
    });
  }

  // Simulasi validasi (nanti kamu ganti dengan validasi ke Google Sheet)
  if (secret_code === "ABC123") {
    res.json({ status: "success", message: "Code valid!" });
  } else {
    res.json({ status: "error", message: "Invalid code" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
