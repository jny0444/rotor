use poseidon::poseidon2::Poseidon2;
mod merkle_tree;

fn main(
    root: pub Field,
    nullifier_hash: pub Field,
    recipient: pub Field,
    // priv inp
    nullifier: Field,
    secret: Field,
    merkleProof: [Field; 20],
    is_even: [bool; 20],
) {
    let commitment: Field = Poseidon2::hash([nullifier, secret], 2);

    let computed_nullifier_hash: Field = Poseidon2::hash([nullifier], 1);
    assert(computed_nullifier_hash == nullifier_hash);

    let computed_root = merkle_tree::calculate_merkle_root(commitment, merkleProof, is_even);
    assert(computed_root == root);

    let _binding = Poseidon2::hash([secret, recipient], 2);
}
