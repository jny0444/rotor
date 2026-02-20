use poseidon::poseidon2::Poseidon2;

pub fn calculate_merkle_root(leaf: Field, merkleProof: [Field; 20], is_even: [bool; 20]) -> Field {
    let mut hash = leaf;

    for i in 0..20 {
        let (left, right) = if is_even[i] {
            (hash, merkleProof[i])
        } else {
            (merkleProof[i], hash)
        };

        hash = Poseidon2::hash([left, right], 2);
    }

    hash
}
