const express = require("express");

const app = express();

app.get("/", (req, res) => {
  res.send("TRACKWISE MINIMAL SERVER WORKING");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Minimal server started on port ${PORT}`);
});