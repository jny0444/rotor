// Privacy: amount is bound in the commitment and exposed as a public input so the
// verifier (relayer/contract) learns it from the proof, not from the client.
// commitment = H(nullifier, secret, amount) so the withdrawn amount is fixed by the note.
use poseidon::poseidon2::Poseidon2;
mod merkle_tree;

fn main(
    root: pub Field,
    nullifier_hash: pub Field,
    recipient: pub Field,
    amount: pub Field,
    // priv inp
    nullifier: Field,
    secret: Field,
    merkleProof: [Field; 20],
    is_even: [bool; 20],
) {
    let commitment: Field = Poseidon2::hash([nullifier, secret, amount], 3);

    let computed_nullifier_hash: Field = Poseidon2::hash([nullifier], 1);
    assert(computed_nullifier_hash == nullifier_hash);

    let computed_root = merkle_tree::calculate_merkle_root(commitment, merkleProof, is_even);
    assert(computed_root == root);

    let _binding = Poseidon2::hash([secret, recipient], 2);
}
