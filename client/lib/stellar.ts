/**
 * Stellar SDK configuration and transaction utilities.
 *
 * Following the "frontend-stellar-sdk" skill from .agents/:
 *  - Horizon for classic payment transactions
 *  - Testnet by default (switch NEXT_PUBLIC_STELLAR_NETWORK to "mainnet" for production)
 *  - buildPaymentTx  → returns unsigned XDR
 *  - submitSignedTransaction → submits signed XDR via Horizon
 */
import * as StellarSdk from "@stellar/stellar-sdk";

// ---------------------------------------------------------------------------
// Network configuration — hardcoded to TESTNET
// ---------------------------------------------------------------------------
export const config = {
  horizonUrl: "https://horizon-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  friendbotUrl: "https://friendbot.stellar.org",
};

export const horizon = new StellarSdk.Horizon.Server(config.horizonUrl);

// ---------------------------------------------------------------------------
// Build an XLM payment transaction (returns unsigned XDR)
// ---------------------------------------------------------------------------
export async function buildPaymentTx(
  sourceAddress: string,
  destinationAddress: string,
  amount: string // in XLM (e.g. "10.5")
): Promise<string> {
  // Validate destination address
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(destinationAddress)) {
    throw new Error("Invalid destination address");
  }

  // Validate amount
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  const account = await horizon.loadAccount(sourceAddress);

  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: destinationAddress,
        asset: StellarSdk.Asset.native(),
        amount: amount,
      })
    )
    .setTimeout(180)
    .build();

  return transaction.toXDR();
}

// ---------------------------------------------------------------------------
// Submit a signed transaction XDR via Horizon
// ---------------------------------------------------------------------------
export async function submitSignedTransaction(signedXdr: string) {
  const transaction = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    config.networkPassphrase
  ) as StellarSdk.Transaction;

  try {
    const response = await horizon.submitTransaction(transaction);
    return {
      success: true as const,
      hash: response.hash,
      ledger: response.ledger,
    };
  } catch (err: unknown) {
    // Horizon returns detailed error info inside response.data.extras
    const error = err as {
      response?: {
        data?: {
          extras?: {
            result_codes?: {
              transaction?: string;
              operations?: string[];
            };
          };
        };
      };
    };
    const resultCodes = error?.response?.data?.extras?.result_codes;
    let message = "Transaction submission failed";

    if (resultCodes?.operations?.length) {
      const opCode = resultCodes.operations[0];
      switch (opCode) {
        case "op_underfunded":
          message = "Insufficient XLM balance";
          break;
        case "op_no_destination":
          message = "Destination account does not exist. Fund it first.";
          break;
        default:
          message = `Transaction failed: ${opCode}`;
      }
    } else if (resultCodes?.transaction) {
      message = `Transaction failed: ${resultCodes.transaction}`;
    }

    return { success: false as const, message };
  }
}
// ---------------------------------------------------------------------------
// Fetch transaction history (for contribution heatmap + transaction list)
// ---------------------------------------------------------------------------
export interface TransactionDay {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface TransactionRecord {
  hash: string;
  date: string;        // YYYY-MM-DD
  time: string;        // HH:MM:SS
  createdAt: string;   // full ISO string
  operationCount: number;
  fee: string;         // in stroops
  memo: string;
  successful: boolean;
  sourceAccount: string;
}

export interface TransactionHistoryResult {
  days: TransactionDay[];
  records: TransactionRecord[];
}

export async function fetchTransactionHistory(
  address: string
): Promise<TransactionHistoryResult> {
  const dateCounts: Record<string, number> = {};
  const records: TransactionRecord[] = [];

  try {
    // Fetch transactions using Horizon pagination (api-rpc-horizon.md skill)
    let page = await horizon
      .transactions()
      .forAccount(address)
      .order("desc")
      .limit(200)
      .call();

    let totalFetched = 0;
    const MAX_RECORDS = 1000; // cap to avoid very long fetches

    while (page.records.length > 0 && totalFetched < MAX_RECORDS) {
      for (const tx of page.records) {
        const date = tx.created_at.split("T")[0];
        const time = tx.created_at.split("T")[1]?.replace("Z", "") || "";
        dateCounts[date] = (dateCounts[date] || 0) + 1;

        records.push({
          hash: tx.hash,
          date,
          time,
          createdAt: tx.created_at,
          operationCount: tx.operation_count,
          fee: String(tx.fee_charged),
          memo: tx.memo || "",
          successful: tx.successful,
          sourceAccount: tx.source_account,
        });
      }
      totalFetched += page.records.length;

      if (page.records.length < 200 || totalFetched >= MAX_RECORDS) break;

      try {
        page = await page.next();
      } catch {
        break; // no more pages
      }
    }
  } catch {
    // Account not found or network error — return empty
    return { days: [], records: [] };
  }

  const days = Object.entries(dateCounts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { days, records };
}

