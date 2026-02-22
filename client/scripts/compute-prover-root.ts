/**
 * Computes the Merkle root for the circuit's Prover.toml test inputs.
 * Use after changing the circuit (e.g. adding amount to commitment).
 *
 * Run from repo root: cd client && npx ts-node --esm scripts/compute-prover-root.ts
 * Or: bun run scripts/compute-prover-root.ts
 */

import { Barretenberg } from "@aztec/bb.js";

const ZERO_HASHES = [
  "0x0d823319708ab99ec915efd4f7e03d11ca1790918e8f04cd14100aceca2aa9ff",
  "0x170a9598425eb05eb8dc06986c6afc717811e874326a79576c02d338bdf14f13",
  "0x273b1a40397b618dac2fc66ceb71399a3e1a60341e546e053cbfa5995e824caf",
  "0x16bf9b1fb2dfa9d88cfb1752d6937a1594d257c2053dff3cb971016bfcffe2a1",
  "0x1288271e1f93a29fa6e748b7468a77a9b8fc3db6b216ce5fc2601fc3e9bd6b36",
  "0x1d47548adec1068354d163be4ffa348ca89f079b039c9191378584abd79edeca",
  "0x0b98a89e6827ef697b8fb2e280a2342d61db1eb5efc229f5f4a77fb333b80bef",
  "0x231555e37e6b206f43fdcd4d660c47442d76aab1ef552aef6db45f3f9cf2e955",
  "0x03d0dc8c92e2844abcc5fdefe8cb67d93034de0862943990b09c6b8e3fa27a86",
  "0x1d51ac275f47f10e592b8e690fd3b28a76106893ac3e60cd7b2a3a443f4e8355",
  "0x16b671eb844a8e4e463e820e26560357edee4ecfdbf5d7b0a28799911505088d",
  "0x115ea0c2f132c5914d5bb737af6eed04115a3896f0d65e12e761ca560083da15",
  "0x139a5b42099806c76efb52da0ec1dde06a836bf6f87ef7ab4bac7d00637e28f0",
  "0x0804853482335a6533eb6a4ddfc215a08026db413d247a7695e807e38debea8e",
  "0x2f0b264ab5f5630b591af93d93ec2dfed28eef017b251e40905cdf7983689803",
  "0x170fc161bf1b9610bf196c173bdae82c4adfd93888dc317f5010822a3ba9ebee",
  "0x0b2e7665b17622cc0243b6fa35110aa7dd0ee3cc9409650172aa786ca5971439",
  "0x12d5a033cbeff854c5ba0c5628ac4628104be6ab370699a1b2b4209e518b0ac5",
  "0x1bc59846eb7eafafc85ba9a99a89562763735322e4255b7c1788a8fe8b90bf5d",
  "0x1b9421fbd79f6972a348a3dd4721781ec25a5d8d27342942ae00aba80a3904d4",
];

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "").padStart(64, "0");
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function toHex(buf: Uint8Array): string {
  return "0x" + Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function main() {
  const fs = await import("fs");
  const out = "/tmp/rotor-prover-root.txt";
  fs.writeFileSync(out, "started\n", "utf8");
  try {
    const nullifier = hexToBytes("0x00f1ad8bace18966d778cb6f1486fe31ee0a192346e91aa07e44baa94e2c9b0f");
    const secret = hexToBytes("0x0081090175082f4f33e2694f90ba79ef86a2a01719997678ccc00ea031355db6");
    const amount = hexToBytes("0x0000000000000000000000000000000000000000000000000000000000989680");

    const bb = await Barretenberg.new();
    fs.writeFileSync(out, "started\nbb done\n", "utf8");

    const commitmentRes = await bb.poseidon2Hash({ inputs: [nullifier, secret, amount] });
    fs.writeFileSync(out, "started\nbb done\ncommitment done\n", "utf8");
    let currentHash = commitmentRes.hash;

    for (let i = 0; i < 20; i++) {
      const sibling = hexToBytes(ZERO_HASHES[i]);
      const hashRes = await bb.poseidon2Hash({ inputs: [currentHash, sibling] });
      currentHash = hashRes.hash;
    }

    const root = toHex(currentHash);
    fs.writeFileSync(out, root, "utf8");
    await bb.destroy();
    console.log("root =", root);
  } catch (e) {
    fs.writeFileSync(out, "error: " + String(e), "utf8");
    throw e;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
