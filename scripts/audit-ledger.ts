/**
 * CLI: npm run audit:ledger
 * Connects to MONGODB_URI, prints balance drift / orphan rows, exits 1 on failure.
 */
import { connectDB } from "../lib/db";
import { runLedgerAudit } from "../lib/ledger-audit";

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not defined");
    process.exit(1);
  }

  await connectDB();
  const report = await runLedgerAudit();

  console.log(
    `Ledger audit: ${report.accountCount} accounts, ${report.transactionCount} transactions`,
  );

  if (report.drifts.length > 0) {
    console.error("\nBalance drift:");
    for (const row of report.drifts) {
      console.error(
        `  ${row.accountId} "${row.name}" cached=${row.cachedBalance} ledger=${row.ledgerSum} delta=${row.delta}`,
      );
    }
  }

  if (report.orphans.length > 0) {
    console.error("\nOrphan transactions:");
    for (const row of report.orphans) {
      console.error(
        `  ${row.transactionId} ${row.sourceType}/${row.sourceId} — ${row.reason}`,
      );
    }
  }

  if (!report.ok) {
    console.error("\nAudit FAILED");
    process.exit(1);
  }

  console.log("Audit OK — no drift, no orphans");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
