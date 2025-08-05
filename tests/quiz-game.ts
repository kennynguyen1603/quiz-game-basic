import * as web3 from "@solana/web3.js";
import * as fs from "fs";
import { Suite } from "mocha";
import {
  QuizSession,
  PlayerScore,
  InitializeQuizArgs,
  AddQuestionArgs,
  StartQuizArgs,
  DelegateArgs,
  SubmitAnswersArgs,
  CommitAnswersArgs,
  CalculateScoresArgs,
} from "./schema";

import {
  DELEGATION_PROGRAM_ID,
  delegationRecordPdaFromDelegatedAccount,
  delegationMetadataPdaFromDelegatedAccount,
  delegateBufferPdaFromDelegatedAccountAndOwnerProgram,
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
} from "@magicblock-labs/ephemeral-rollups-sdk";

import * as dotenv from "dotenv";
import { initializeKeypair } from "./initialize-keypair";

dotenv.config();

describe("Quiz Game Tests:", function (this: Suite) {
  this.timeout(60000); // Set timeout for the test

  // Get programId from target folder
  const keypairPath = "target/deploy/quiz_game-keypair.json";
  const secretKeyArray = Uint8Array.from(
    JSON.parse(fs.readFileSync(keypairPath, "utf8"))
  );
  const keypair = web3.Keypair.fromSecretKey(secretKeyArray);
  const PROGRAM_ID = keypair.publicKey;

  // Set up connections
  const connectionBaseLayer = new web3.Connection(
    "https://api.devnet.solana.com",
    { wsEndpoint: "wss://api.devnet.solana.com" }
  );
  const connectionEphemeralRollup = new web3.Connection(
    process.env.PROVIDER_ENDPOINT || "https://devnet.magicblock.app/",
    { wsEndpoint: process.env.WS_ENDPOINT || "wss://devnet.magicblock.app/" }
  );

  console.log("Program ID: ", PROGRAM_ID.toString());
  console.log("Base Layer Connection: ", connectionBaseLayer.rpcEndpoint);
  console.log(
    "Ephemeral Rollup Connection: ",
    connectionEphemeralRollup.rpcEndpoint
  );

  // Variables to be initialized in before hook
  let hostKeypair: web3.Keypair;
  let player1Keypair: web3.Keypair;
  let player2Keypair: web3.Keypair;
  let quizSessionPda: web3.PublicKey;
  let question1Pda: web3.PublicKey;
  let question2Pda: web3.PublicKey;
  let player1AnswerPda: web3.PublicKey;
  let player2AnswerPda: web3.PublicKey;
  let player1ScorePda: web3.PublicKey;
  let player2ScorePda: web3.PublicKey;

  before(async function () {
    // Get the funded keypair for transferring funds
    const fundedKeypair = await initializeKeypair(connectionBaseLayer);

    // Create fresh keypairs for each test run to avoid account conflicts
    hostKeypair = web3.Keypair.generate();
    player1Keypair = web3.Keypair.generate();
    player2Keypair = web3.Keypair.generate();

    // Transfer SOL from funded keypair to test keypairs
    const transferAmount = 0.1 * web3.LAMPORTS_PER_SOL; // Increase to 0.1 SOL each

    const transferTxHost = new web3.Transaction().add(
      web3.SystemProgram.transfer({
        fromPubkey: fundedKeypair.publicKey,
        toPubkey: hostKeypair.publicKey,
        lamports: transferAmount,
      })
    );
    await web3.sendAndConfirmTransaction(connectionBaseLayer, transferTxHost, [
      fundedKeypair,
    ]);

    const transferTx1 = new web3.Transaction().add(
      web3.SystemProgram.transfer({
        fromPubkey: fundedKeypair.publicKey,
        toPubkey: player1Keypair.publicKey,
        lamports: transferAmount,
      })
    );
    await web3.sendAndConfirmTransaction(connectionBaseLayer, transferTx1, [
      fundedKeypair,
    ]);

    const transferTx2 = new web3.Transaction().add(
      web3.SystemProgram.transfer({
        fromPubkey: fundedKeypair.publicKey,
        toPubkey: player2Keypair.publicKey,
        lamports: transferAmount,
      })
    );
    await web3.sendAndConfirmTransaction(connectionBaseLayer, transferTx2, [
      fundedKeypair,
    ]);

    // Get PDAs
    [quizSessionPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("quiz_session"), hostKeypair.publicKey.toBuffer()],
      PROGRAM_ID
    );

    [question1Pda] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("quiz_question"),
        quizSessionPda.toBuffer(),
        Buffer.from([0]),
      ],
      PROGRAM_ID
    );

    [question2Pda] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("quiz_question"),
        quizSessionPda.toBuffer(),
        Buffer.from([1]),
      ],
      PROGRAM_ID
    );

    [player1AnswerPda] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("player_answer"),
        quizSessionPda.toBuffer(),
        player1Keypair.publicKey.toBuffer(),
      ],
      PROGRAM_ID
    );

    [player2AnswerPda] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("player_answer"),
        quizSessionPda.toBuffer(),
        player2Keypair.publicKey.toBuffer(),
      ],
      PROGRAM_ID
    );

    [player1ScorePda] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("player_score"),
        quizSessionPda.toBuffer(),
        player1Keypair.publicKey.toBuffer(),
      ],
      PROGRAM_ID
    );

    [player2ScorePda] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("player_score"),
        quizSessionPda.toBuffer(),
        player2Keypair.publicKey.toBuffer(),
      ],
      PROGRAM_ID
    );

    console.log("Quiz Session PDA: ", quizSessionPda.toString());
    console.log("Question 1 PDA: ", question1Pda.toString());
    console.log("Question 2 PDA: ", question2Pda.toString());
    console.log("Player 1 Answer PDA: ", player1AnswerPda.toString());
    console.log("Player 2 Answer PDA: ", player2AnswerPda.toString());
  });

  it("Initialize quiz session on Solana", async function () {
    const start = Date.now();

    // Check host balance before proceeding
    const hostBalance = await connectionBaseLayer.getBalance(
      hostKeypair.publicKey
    );
    console.log(`Host balance: ${hostBalance / web3.LAMPORTS_PER_SOL} SOL`);

    if (hostBalance < 0.01 * web3.LAMPORTS_PER_SOL) {
      throw new Error("Host account has insufficient balance");
    }

    const tx = new web3.Transaction();
    const keys = [
      // Host
      {
        pubkey: hostKeypair.publicKey,
        isSigner: true,
        isWritable: true,
      },
      // Quiz Session Account
      {
        pubkey: quizSessionPda,
        isSigner: false,
        isWritable: true,
      },
      // System Program
      {
        pubkey: web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ];

    const initializeArgs = new InitializeQuizArgs({
      question_count: 2,
    }); // 2 questions
    const serializedData = initializeArgs.serialize();

    const initializeIx = new web3.TransactionInstruction({
      keys: keys,
      programId: PROGRAM_ID,
      data: serializedData,
    });

    tx.add(initializeIx);

    const txHash = await web3.sendAndConfirmTransaction(
      connectionBaseLayer,
      tx,
      [hostKeypair],
      {
        skipPreflight: false, // Enable preflight to get better error messages
        commitment: "confirmed",
      }
    );

    const duration = Date.now() - start;
    console.log(`${duration}ms (Base Layer) Initialize Quiz txHash: ${txHash}`);

    // Wait for account to be finalized and retry
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify the account was created
    let quizAccountInfo = await connectionBaseLayer.getAccountInfo(
      quizSessionPda,
      "confirmed"
    );
    let retries = 0;
    while (!quizAccountInfo && retries < 5) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      quizAccountInfo = await connectionBaseLayer.getAccountInfo(
        quizSessionPda,
        "confirmed"
      );
      retries++;
    }

    console.log("Quiz account created:", !!quizAccountInfo);
    if (quizAccountInfo) {
      console.log("Quiz account data length:", quizAccountInfo.data.length);
      console.log("Quiz account owner:", quizAccountInfo.owner.toString());
    }
  });

  it("Add first question on Solana", async function () {
    const start = Date.now();

    // Check quiz session account first
    const quizAccountInfo = await connectionBaseLayer.getAccountInfo(
      quizSessionPda,
      "confirmed"
    );
    console.log("Quiz account data length:", quizAccountInfo?.data.length);

    if (!quizAccountInfo) {
      throw new Error("Quiz session account not found. Initialize quiz first.");
    }

    try {
      const quizSession = QuizSession.deserialize(
        Buffer.from(quizAccountInfo.data)
      );
      console.log("Quiz session active:", quizSession.active);
      console.log("Quiz session completed:", quizSession.completed);
      console.log(
        "Quiz session host:",
        Buffer.from(quizSession.host).toString("hex")
      );
      console.log(
        "Expected host:",
        hostKeypair.publicKey.toBuffer().toString("hex")
      );
    } catch (e) {
      console.log("Failed to deserialize quiz session:", e);
      throw e;
    }

    const tx = new web3.Transaction();
    const keys = [
      // Host
      {
        pubkey: hostKeypair.publicKey,
        isSigner: true,
        isWritable: true,
      },
      // Quiz Session Account
      {
        pubkey: quizSessionPda,
        isSigner: false,
        isWritable: false,
      },
      // Question Account
      {
        pubkey: question1Pda,
        isSigner: false,
        isWritable: true,
      },
      // System Program
      {
        pubkey: web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ];

    const addQuestionArgs = new AddQuestionArgs({
      question_index: 0,
      question_text: "What is the capital of France?",
      options: ["London", "Berlin", "Paris", "Madrid"] as [
        string,
        string,
        string,
        string,
      ],
      correct_answer_index: 2,
    });

    const serializedData = addQuestionArgs.serialize();

    const addQuestionIx = new web3.TransactionInstruction({
      keys: keys,
      programId: PROGRAM_ID,
      data: serializedData,
    });

    tx.add(addQuestionIx);

    const txHash = await web3.sendAndConfirmTransaction(
      connectionBaseLayer,
      tx,
      [hostKeypair],
      {
        skipPreflight: false,
        commitment: "confirmed",
      }
    );

    const duration = Date.now() - start;
    console.log(`${duration}ms (Base Layer) Add Question 1 txHash: ${txHash}`);
  });

  it("Add second question on Solana", async function () {
    const start = Date.now();

    const tx = new web3.Transaction();
    const keys = [
      // Host
      {
        pubkey: hostKeypair.publicKey,
        isSigner: true,
        isWritable: true,
      },
      // Quiz Session Account
      {
        pubkey: quizSessionPda,
        isSigner: false,
        isWritable: false,
      },
      // Question Account
      {
        pubkey: question2Pda,
        isSigner: false,
        isWritable: true,
      },
      // System Program
      {
        pubkey: web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ];

    const addQuestionArgs = new AddQuestionArgs({
      question_index: 1,
      question_text: "What is 2 + 2?",
      options: ["3", "4", "5", "6"] as [string, string, string, string],
      correct_answer_index: 1,
    });

    const serializedData = addQuestionArgs.serialize();

    const addQuestionIx = new web3.TransactionInstruction({
      keys: keys,
      programId: PROGRAM_ID,
      data: serializedData,
    });

    tx.add(addQuestionIx);

    const txHash = await web3.sendAndConfirmTransaction(
      connectionBaseLayer,
      tx,
      [hostKeypair],
      {
        skipPreflight: false,
        commitment: "confirmed",
      }
    );

    const duration = Date.now() - start;
    console.log(`${duration}ms (Base Layer) Add Question 2 txHash: ${txHash}`);
  });

  it("Start quiz on Solana", async function () {
    const start = Date.now();

    // Check if questions were added first with confirmed commitment
    const question1AccountInfo = await connectionBaseLayer.getAccountInfo(
      question1Pda,
      "confirmed"
    );
    const question2AccountInfo = await connectionBaseLayer.getAccountInfo(
      question2Pda,
      "confirmed"
    );

    if (!question1AccountInfo || !question2AccountInfo) {
      // Wait a bit and retry
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const question1AccountInfoRetry =
        await connectionBaseLayer.getAccountInfo(question1Pda, "confirmed");
      const question2AccountInfoRetry =
        await connectionBaseLayer.getAccountInfo(question2Pda, "confirmed");

      if (!question1AccountInfoRetry || !question2AccountInfoRetry) {
        throw new Error("Questions must be added before starting quiz");
      }
    }

    const tx = new web3.Transaction();
    const keys = [
      // Host
      {
        pubkey: hostKeypair.publicKey,
        isSigner: true,
        isWritable: true,
      },
      // Quiz Session Account
      {
        pubkey: quizSessionPda,
        isSigner: false,
        isWritable: true,
      },
    ];

    const startQuizArgs = new StartQuizArgs();
    const serializedData = startQuizArgs.serialize();

    const startQuizIx = new web3.TransactionInstruction({
      keys: keys,
      programId: PROGRAM_ID,
      data: serializedData,
    });

    tx.add(startQuizIx);

    const txHash = await web3.sendAndConfirmTransaction(
      connectionBaseLayer,
      tx,
      [hostKeypair],
      {
        skipPreflight: false,
        commitment: "confirmed",
      }
    );

    const duration = Date.now() - start;
    console.log(`${duration}ms (Base Layer) Start Quiz txHash: ${txHash}`);
  });

  it("Delegate Player 1 to ER", async function () {
    const start = Date.now();

    const tx = new web3.Transaction();
    const keys = [
      // Player
      {
        pubkey: player1Keypair.publicKey,
        isSigner: true,
        isWritable: true,
      },
      // System Program
      {
        pubkey: web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
      // Player Answer Account
      {
        pubkey: player1AnswerPda,
        isSigner: false,
        isWritable: true,
      },
      // Owner Program (Quiz Program)
      {
        pubkey: PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      // Delegation Buffer
      {
        pubkey: delegateBufferPdaFromDelegatedAccountAndOwnerProgram(
          player1AnswerPda,
          PROGRAM_ID
        ),
        isSigner: false,
        isWritable: true,
      },
      // Delegation Record
      {
        pubkey: delegationRecordPdaFromDelegatedAccount(player1AnswerPda),
        isSigner: false,
        isWritable: true,
      },
      // Delegation Metadata
      {
        pubkey: delegationMetadataPdaFromDelegatedAccount(player1AnswerPda),
        isSigner: false,
        isWritable: false,
      },
      // Delegation Program
      {
        pubkey: DELEGATION_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      // Quiz Session Account
      {
        pubkey: quizSessionPda,
        isSigner: false,
        isWritable: true,
      },
    ];

    const delegateArgs = new DelegateArgs();
    const serializedData = delegateArgs.serialize();

    const delegateIx = new web3.TransactionInstruction({
      keys: keys,
      programId: PROGRAM_ID,
      data: serializedData,
    });

    tx.add(delegateIx);

    const txHash = await web3.sendAndConfirmTransaction(
      connectionBaseLayer,
      tx,
      [player1Keypair],
      {
        skipPreflight: true,
        commitment: "confirmed",
      }
    );

    const duration = Date.now() - start;
    console.log(
      `${duration}ms (Base Layer) Delegate Player 1 txHash: ${txHash}`
    );
  });

  it("Delegate Player 2 to ER", async function () {
    const start = Date.now();

    const tx = new web3.Transaction();
    const keys = [
      // Player
      {
        pubkey: player2Keypair.publicKey,
        isSigner: true,
        isWritable: true,
      },
      // System Program
      {
        pubkey: web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
      // Player Answer Account
      {
        pubkey: player2AnswerPda,
        isSigner: false,
        isWritable: true,
      },
      // Owner Program (Quiz Program)
      {
        pubkey: PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      // Delegation Buffer
      {
        pubkey: delegateBufferPdaFromDelegatedAccountAndOwnerProgram(
          player2AnswerPda,
          PROGRAM_ID
        ),
        isSigner: false,
        isWritable: true,
      },
      // Delegation Record
      {
        pubkey: delegationRecordPdaFromDelegatedAccount(player2AnswerPda),
        isSigner: false,
        isWritable: true,
      },
      // Delegation Metadata
      {
        pubkey: delegationMetadataPdaFromDelegatedAccount(player2AnswerPda),
        isSigner: false,
        isWritable: false,
      },
      // Delegation Program
      {
        pubkey: DELEGATION_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      // Quiz Session Account
      {
        pubkey: quizSessionPda,
        isSigner: false,
        isWritable: true,
      },
    ];

    const delegateArgs = new DelegateArgs();
    const serializedData = delegateArgs.serialize();

    const delegateIx = new web3.TransactionInstruction({
      keys: keys,
      programId: PROGRAM_ID,
      data: serializedData,
    });

    tx.add(delegateIx);

    const txHash = await web3.sendAndConfirmTransaction(
      connectionBaseLayer,
      tx,
      [player2Keypair],
      {
        skipPreflight: true,
        commitment: "confirmed",
      }
    );

    const duration = Date.now() - start;
    console.log(
      `${duration}ms (Base Layer) Delegate Player 2 txHash: ${txHash}`
    );
  });

  it("Player 1 submits answers on ER", async function () {
    const start = Date.now();

    const tx = new web3.Transaction();
    const keys = [
      // Player
      {
        pubkey: player1Keypair.publicKey,
        isSigner: true,
        isWritable: true,
      },
      // Player Answer Account
      {
        pubkey: player1AnswerPda,
        isSigner: false,
        isWritable: true,
      },
      // Quiz Session Account
      {
        pubkey: quizSessionPda,
        isSigner: false,
        isWritable: false,
      },
    ];

    // Player 1 answers: Paris (2) and 4 (1) - both correct
    const submitAnswersArgs = new SubmitAnswersArgs({
      answers: [2, 1],
    });
    const serializedData = submitAnswersArgs.serialize();

    const submitAnswersIx = new web3.TransactionInstruction({
      keys: keys,
      programId: PROGRAM_ID,
      data: serializedData,
    });

    tx.add(submitAnswersIx);

    const txHash = await web3.sendAndConfirmTransaction(
      connectionEphemeralRollup,
      tx,
      [player1Keypair],
      {
        skipPreflight: true,
        commitment: "confirmed",
      }
    );

    const duration = Date.now() - start;
    console.log(`${duration}ms (ER) Player 1 Submit Answers txHash: ${txHash}`);
  });

  it("Player 2 submits answers on ER", async function () {
    const start = Date.now();

    const tx = new web3.Transaction();
    const keys = [
      // Player
      {
        pubkey: player2Keypair.publicKey,
        isSigner: true,
        isWritable: true,
      },
      // Player Answer Account
      {
        pubkey: player2AnswerPda,
        isSigner: false,
        isWritable: true,
      },
      // Quiz Session Account
      {
        pubkey: quizSessionPda,
        isSigner: false,
        isWritable: false,
      },
    ];

    // Player 2 answers: London (0) and 4 (1) - one correct, one wrong
    const submitAnswersArgs = new SubmitAnswersArgs({
      answers: [0, 1],
    });
    const serializedData = submitAnswersArgs.serialize();

    const submitAnswersIx = new web3.TransactionInstruction({
      keys: keys,
      programId: PROGRAM_ID,
      data: serializedData,
    });

    tx.add(submitAnswersIx);

    const txHash = await web3.sendAndConfirmTransaction(
      connectionEphemeralRollup,
      tx,
      [player2Keypair],
      {
        skipPreflight: true,
        commitment: "confirmed",
      }
    );

    const duration = Date.now() - start;
    console.log(`${duration}ms (ER) Player 2 Submit Answers txHash: ${txHash}`);
  });

  it("Commit answers from ER to Solana", async function () {
    const start = Date.now();

    const tx = new web3.Transaction();
    const keys = [
      // Host
      {
        pubkey: hostKeypair.publicKey,
        isSigner: true,
        isWritable: true,
      },
      // Quiz Session Account
      {
        pubkey: quizSessionPda,
        isSigner: false,
        isWritable: false,
      },
      // Magic Program
      {
        pubkey: MAGIC_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      // Magic Context
      {
        pubkey: MAGIC_CONTEXT_ID,
        isSigner: false,
        isWritable: false,
      },
    ];

    const commitAnswersArgs = new CommitAnswersArgs();
    const serializedData = commitAnswersArgs.serialize();

    const commitAnswersIx = new web3.TransactionInstruction({
      keys: keys,
      programId: PROGRAM_ID,
      data: serializedData,
    });

    tx.add(commitAnswersIx);

    const txHash = await web3.sendAndConfirmTransaction(
      connectionBaseLayer,
      tx,
      [hostKeypair],
      {
        skipPreflight: true,
        commitment: "confirmed",
      }
    );

    const duration = Date.now() - start;
    console.log(`${duration}ms (Base Layer) Commit Answers txHash: ${txHash}`);
  });

  it("Calculate scores on Solana", async function () {
    const start = Date.now();

    const tx = new web3.Transaction();
    const keys = [
      // Host
      {
        pubkey: hostKeypair.publicKey,
        isSigner: true,
        isWritable: true,
      },
      // Quiz Session Account
      {
        pubkey: quizSessionPda,
        isSigner: false,
        isWritable: true,
      },
      // Question 1 Account
      {
        pubkey: question1Pda,
        isSigner: false,
        isWritable: false,
      },
      // Question 2 Account
      {
        pubkey: question2Pda,
        isSigner: false,
        isWritable: false,
      },
      // Player 1 Answer Account
      {
        pubkey: player1AnswerPda,
        isSigner: false,
        isWritable: false,
      },
      // Player 1 Score Account
      {
        pubkey: player1ScorePda,
        isSigner: false,
        isWritable: true,
      },
      // System Program
      {
        pubkey: web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
      // Player 2 Answer Account
      {
        pubkey: player2AnswerPda,
        isSigner: false,
        isWritable: false,
      },
      // Player 2 Score Account
      {
        pubkey: player2ScorePda,
        isSigner: false,
        isWritable: true,
      },
    ];

    const calculateScoresArgs = new CalculateScoresArgs();
    const serializedData = calculateScoresArgs.serialize();

    const calculateScoresIx = new web3.TransactionInstruction({
      keys: keys,
      programId: PROGRAM_ID,
      data: serializedData,
    });

    tx.add(calculateScoresIx);

    const txHash = await web3.sendAndConfirmTransaction(
      connectionBaseLayer,
      tx,
      [hostKeypair],
      {
        skipPreflight: true,
        commitment: "confirmed",
      }
    );

    const duration = Date.now() - start;
    console.log(
      `${duration}ms (Base Layer) Calculate Scores txHash: ${txHash}`
    );
  });

  it("Read final scores", async function () {
    // Read Player 1 score
    const player1ScoreAccountInfo =
      await connectionBaseLayer.getAccountInfo(player1ScorePda);
    if (player1ScoreAccountInfo) {
      const player1Score = PlayerScore.deserialize(
        Buffer.from(player1ScoreAccountInfo.data)
      );
      console.log(`Player 1 scored: ${player1Score.score} points`);
    }

    // Read Player 2 score
    const player2ScoreAccountInfo =
      await connectionBaseLayer.getAccountInfo(player2ScorePda);
    if (player2ScoreAccountInfo) {
      const player2Score = PlayerScore.deserialize(
        Buffer.from(player2ScoreAccountInfo.data)
      );
      console.log(`Player 2 scored: ${player2Score.score} points`);
    }

    // Read quiz session status
    const quizSessionAccountInfo =
      await connectionBaseLayer.getAccountInfo(quizSessionPda);
    if (quizSessionAccountInfo) {
      const quizSession = QuizSession.deserialize(
        Buffer.from(quizSessionAccountInfo.data)
      );
      console.log(`Quiz completed: ${quizSession.completed}`);
      console.log(`Total players: ${quizSession.player_count}`);
    }
  });
});
