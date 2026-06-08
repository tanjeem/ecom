import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { dashboardCache } from "@/lib/cache";

const LEDGER_PATH = path.join(process.cwd(), "lib/data/finance_ledger.json");

function readLedger() {
  try {
    if (!fs.existsSync(LEDGER_PATH)) {
      return {};
    }
    const data = fs.readFileSync(LEDGER_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading financial ledger:", error);
    return {};
  }
}

function writeLedger(data: any) {
  try {
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(data, null, 2), "utf8");
    // Invalidate dashboard caches to maintain data freshness
    dashboardCache.clear();
    return true;
  } catch (error) {
    console.error("Error writing financial ledger:", error);
    return false;
  }
}

export async function GET() {
  const ledger = readLedger();
  return NextResponse.json(ledger);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, payload } = body;
    const ledger = readLedger();

    if (!action) {
      return NextResponse.json({ error: "Missing action parameter" }, { status: 400 });
    }

    const generateId = () => Math.random().toString(36).substring(2, 9);

    switch (action) {
      case "addPayout": {
        if (!ledger.payouts) ledger.payouts = [];
        const newPayout = {
          id: "p_" + generateId(),
          date: payload.date || new Date().toISOString().slice(0, 10),
          amount: Number(payload.amount) || 0,
          product: payload.product || "",
          comments: payload.comments || "",
        };
        ledger.payouts.unshift(newPayout);
        break;
      }

      case "addAdSpend": {
        if (!ledger.adSpend) ledger.adSpend = [];
        const newAd = {
          id: "a_" + generateId(),
          date: payload.date || new Date().toISOString().slice(0, 10),
          amountUSD: Number(payload.amountUSD) || 0,
          amountBDT: Number(payload.amountBDT) || 0,
          comments: payload.comments || "",
        };
        ledger.adSpend.unshift(newAd);
        break;
      }

      case "addMscShoot": {
        if (!ledger.mscShoot) ledger.mscShoot = [];
        const newCost = {
          id: "m_" + generateId(),
          item: payload.item || "",
          cost: Number(payload.cost) || 0,
          comments: payload.comments || "",
        };
        ledger.mscShoot.unshift(newCost);
        break;
      }

      case "addFunding": {
        if (!ledger.funding) ledger.funding = [];
        const newFund = {
          id: "u_" + generateId(),
          date: payload.date || new Date().toISOString().slice(0, 10),
          amount: Number(payload.amount) || 0,
          from: payload.from || "",
          details: payload.details || "",
        };
        ledger.funding.unshift(newFund);
        break;
      }

      case "togglePaidStatus": {
        const { id, paid } = payload;
        if (!ledger.manufacturingDetails) {
          return NextResponse.json({ error: "No manufacturing details ledger" }, { status: 404 });
        }
        const item = ledger.manufacturingDetails.find((d: any) => d.id === id);
        if (item) {
          item.paid = paid;
        } else {
          return NextResponse.json({ error: `Manufacturing entry ID ${id} not found` }, { status: 404 });
        }
        break;
      }

      default:
        return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
    }

    const success = writeLedger(ledger);
    if (success) {
      return NextResponse.json({ success: true, ledger });
    } else {
      return NextResponse.json({ error: "Failed to write database updates" }, { status: 500 });
    }
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json({ error: error.message || "Server Error" }, { status: 500 });
  }
}
