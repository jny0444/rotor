/**
 * Stellar SDK configuration and transaction utilities.
 *
 * Supports both:
 *  - Classic Horizon transactions (payments, history)
 *  - Soroban contract invocations (deposit via rotor-core)
 */
import * as StellarSdk from "@stellar/stellar-sdk";

// ---------------------------------------------------------------------------
// Network configuration
// ---------------------------------------------------------------------------
export const config = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  friendbotUrl: "https://friendbot.stellar.org",
};

export const horizon = new StellarSdk.Horizon.Server(config.horizonUrl);
export const rpc = new StellarSdk.rpc.Server(config.rpcUrl);

// Rotor contract and XLM SAC on testnet
export const ROTOR_CONTRACT_ID =
  process.env.NEXT_PUBLIC_ROTOR_CONTRACT_ID || "";
export const XLM_SAC_ID =
  process.env.NEXT_PUBLIC_XLM_SAC_ID ||
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

// ---------------------------------------------------------------------------
// Muxed address helpers (CAP-27 / SEP-23)
// ---------------------------------------------------------------------------

export function createMuxedAddress(gAddress: string, id: string): string {
  const baseAccount = new StellarSdk.Account(gAddress, "0");
  const muxed = new StellarSdk.MuxedAccount(baseAccount, id);
  return muxed.accountId();
}

export function randomMuxedId(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  let id = BigInt(0);
  for (let i = 0; i < 8; i++) {
    id = (id << BigInt(8)) | BigInt(buf[i]);
  }
  return id.toString();
}

// ---------------------------------------------------------------------------
// Soroban: Transfer XLM to the rotor-core contract via the SAC
//
// This is a direct token transfer — separate from the deposit call — so
// the deposit function itself carries no amount information.
// ---------------------------------------------------------------------------
export async function buildFundContractTx(
  depositorAddress: string,
  amountStroops: number
): Promise<string> {
  if (!ROTOR_CONTRACT_ID) {
    throw new Error("NEXT_PUBLIC_ROTOR_CONTRACT_ID is not set in environment");
  }

  const account = await rpc.getAccount(depositorAddress);
  const sacContract = new StellarSdk.Contract(XLM_SAC_ID);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      sacContract.call(
        "transfer",
        new StellarSdk.Address(depositorAddress).toScVal(),
        new StellarSdk.Address(ROTOR_CONTRACT_ID).toScVal(),
        StellarSdk.nativeToScVal(BigInt(amountStroops), { type: "i128" })
      )
    )
    .setTimeout(180)
    .build();

  const prepared = await rpc.prepareTransaction(tx);
  return prepared.toXDR();
}

// ---------------------------------------------------------------------------
// Soroban: Record a commitment in the rotor-core Merkle tree
//
// Calls: deposit(depositor, commitment) — no amount parameter.
// The token transfer is handled separately by buildFundContractTx.
// ---------------------------------------------------------------------------
export async function buildDepositTx(
  depositorAddress: string,
  commitmentHex: string
): Promise<string> {
  if (!ROTOR_CONTRACT_ID) {
    throw new Error("NEXT_PUBLIC_ROTOR_CONTRACT_ID is not set in environment");
  }

  const account = await rpc.getAccount(depositorAddress);
  const contract = new StellarSdk.Contract(ROTOR_CONTRACT_ID);

  const commitmentBytes = Buffer.from(
    commitmentHex.replace(/^0x/, ""),
    "hex"
  );

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        "deposit",
        new StellarSdk.Address(depositorAddress).toScVal(),
        StellarSdk.xdr.ScVal.scvBytes(commitmentBytes)
      )
    )
    .setTimeout(180)
    .build();

  const prepared = await rpc.prepareTransaction(tx);
  return prepared.toXDR();
}

// ---------------------------------------------------------------------------
// Submit a signed Soroban transaction via RPC and poll for confirmation
// ---------------------------------------------------------------------------
export async function submitSorobanTx(signedXdr: string): Promise<{
  success: true;
  hash: string;
} | {
  success: false;
  message: string;
}> {
  const tx = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    config.networkPassphrase
  );

  try {
    const sendRes = await rpc.sendTransaction(tx);
    if (sendRes.status === "ERROR") {
      return {
        success: false,
        message: `Transaction rejected: ${JSON.stringify(sendRes.errorResult)}`,
      };
    }

    // Poll for confirmation
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const result = await rpc.getTransaction(sendRes.hash);
      if (result.status === "SUCCESS") {
        return { success: true, hash: sendRes.hash };
      }
      if (result.status === "FAILED") {
        return { success: false, message: "Transaction failed on-chain" };
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return { success: false, message: "Transaction confirmation timed out" };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Soroban submission failed";
    return { success: false, message };
  }
}

// ---------------------------------------------------------------------------
// Classic: Build an XLM payment transaction (returns unsigned XDR)
// ---------------------------------------------------------------------------
export async function buildPaymentTx(
  sourceAddress: string,
  destinationAddress: string,
  amount: string
): Promise<string> {
  const isValidAddress =
    StellarSdk.StrKey.isValidEd25519PublicKey(destinationAddress) ||
    StellarSdk.StrKey.isValidMed25519PublicKey(destinationAddress);
  if (!isValidAddress) {
    throw new Error(
      "Invalid destination address (expected G... or M... address)"
    );
  }

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
// Classic: Submit a signed transaction XDR via Horizon
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
  date: string;
  count: number;
}

export interface TransactionRecord {
  hash: string;
  date: string;
  time: string;
  createdAt: string;
  operationCount: number;
  fee: string;
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
    let page = await horizon
      .transactions()
      .forAccount(address)
      .order("desc")
      .limit(200)
      .call();

    let totalFetched = 0;
    const MAX_RECORDS = 1000;

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
        break;
      }
    }
  } catch {
    return { days: [], records: [] };
  }

  const days = Object.entries(dateCounts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { days, records };
}
