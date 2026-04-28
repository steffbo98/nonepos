import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "OmniSync POS Backend is running" });
  });

  // Mock Payment Integration Endpoint
  app.post("/api/payments/process", (req, res) => {
    const { amount, method, orderId, phone } = req.body;
    console.log(`Processing ${method} payment for Order ${orderId}: Ksh ${amount}`);
    
    if (method === 'MPESA') {
      console.log(`Sending STK Push to ${phone}...`);
    }

    // Simulate payment gateway delay
    setTimeout(() => {
      const prefix = method === 'MPESA' ? 'MPSE' : 'TXN';
      res.json({ 
        success: true, 
        transactionId: `${prefix}_${Math.random().toString(36).substr(2, 9).toUpperCase()}` 
      });
    }, 1500);
  });

  // Mock Notification Endpoint
  app.post("/api/notifications/send", (req, res) => {
    const { type, recipient, message } = req.body;
    console.log(`Sending ${type} notification to ${recipient}: ${message}`);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
