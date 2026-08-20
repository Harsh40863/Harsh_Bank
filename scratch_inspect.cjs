const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/Harsh_Bank";

async function inspectLedger() {
    console.log("🔌 Connecting to DB:", mongoUri);
    await mongoose.connect(mongoUri);
    console.log("Connected.");

    const ledgerSchema = new mongoose.Schema({}, { strict: false, collection: "legders" });
    const Ledger = mongoose.model("inspect_ledger", ledgerSchema);

    const entries = await Ledger.find({}).sort({ createdAt: -1 }).limit(20);
    console.log("\n--- LAST 20 LEDGER ENTRIES ---");
    for (const entry of entries) {
        console.log({
            id: entry._id,
            account: entry.account,
            ammount: entry.ammount,
            type: entry.type,
            category: entry.category,
            createdAt: entry.createdAt,
            raw: entry.toObject()
        });
    }

    const txSchema = new mongoose.Schema({}, { strict: false, collection: "transactions" });
    const Transaction = mongoose.model("inspect_tx", txSchema);

    const txs = await Transaction.find({}).sort({ createdAt: -1 }).limit(10);
    console.log("\n--- LAST 10 TRANSACTIONS ---");
    for (const tx of txs) {
        console.log({
            id: tx._id,
            fromAccount: tx.fromAccount,
            toAccount: tx.toAccount,
            ammount: tx.ammount,
            status: tx.status,
            idempotencyKey: tx.idempotentKey || tx.IdempotentKey,
            createdAt: tx.createdAt
        });
    }

    await mongoose.connection.close();
    console.log("\nDisconnected.");
}

inspectLedger().catch(err => {
    console.error("Inspect error:", err);
    process.exit(1);
});
