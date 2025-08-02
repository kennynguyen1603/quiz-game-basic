#!/bin/bash

echo "Building and deploying Quiz Game..."

# Build the Rust program
echo "Building Rust program..."
cargo build-sbf

# Check if keypair exists, if not create one
if [ ! -f "target/deploy/quiz_game-keypair.json" ]; then
    echo "Creating program keypair..."
    solana-keygen new --outfile target/deploy/quiz_game-keypair.json --no-bip39-passphrase
fi

# Deploy to devnet
echo "Deploying to devnet..."
solana program deploy target/sbpf-solana-solana/release/quiz_game.so --keypair target/deploy/quiz_game-keypair.json --url devnet

echo "Quiz Game deployed successfully!"
echo "Program ID: $(solana-keygen pubkey target/deploy/quiz_game-keypair.json)"
