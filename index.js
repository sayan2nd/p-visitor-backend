const express = require("express");
const mongoose = require("mongoose");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" })); // Allow all origins (or specify your frontend origin)
app.use(express.json());

// MongoDB connection
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;

db.once("open", () => console.log("Connected to MongoDB"));

// Visitor Schema
const visitorSchema = new mongoose.Schema({
    userId: String,
    timestamp: { type: Date, default: Date.now },
    fake: { type: Boolean, default: false },
});

const Visitor = mongoose.model("Visitor", visitorSchema);

// WebSocket server
const port = process.env.PORT || 3000; // Use dynamic port
const server = app.listen(port, () => console.log(`Server running on port ${port}`));
const wss = new WebSocket.Server({ server });

wss.on("connection", async (ws) => {
    try {
        const count = await Visitor.countDocuments({});
        ws.send(JSON.stringify({ visitors: count }));
    } catch (error) {
        console.error("Error getting visitor count:", error);
    }
});

// Track real visitors
app.post("/track", async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).send("Missing userId");
    }

    const existingVisitor = await Visitor.findOne({ userId });
    if (!existingVisitor) {
        await Visitor.create({ userId });
        broadcastVisitorCount(); // Notify WebSocket clients
    }

    res.sendStatus(200);
});

// Add a fake visitor every minute
setInterval(async () => {
    await Visitor.create({ userId: null, fake: true });
    broadcastVisitorCount();
}, 60 * 60 * 1000);

// Function to broadcast visitor count
const broadcastVisitorCount = async () => {
    const count = await Visitor.countDocuments();
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ visitors: count }));
        }
    });
};
