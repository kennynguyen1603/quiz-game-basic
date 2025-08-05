import * as borsh from "borsh";

export class QuizQuestion {
  question_text: string;
  options: [string, string, string, string];
  correct_answer_index: number;

  constructor(props: {
    question_text: string;
    options: [string, string, string, string];
    correct_answer_index: number;
  }) {
    this.question_text = props.question_text;
    this.options = props.options;
    this.correct_answer_index = props.correct_answer_index;
  }

  static schema = new Map([
    [
      QuizQuestion,
      {
        kind: "struct",
        fields: [
          ["question_text", "string"],
          ["options", ["string", 4]],
          ["correct_answer_index", "u8"],
        ],
      },
    ],
  ]);
}

export class QuizSession {
  host: Uint8Array;
  question_count: number;
  player_count: number;
  active: boolean;
  completed: boolean;

  constructor(props: {
    host: Uint8Array;
    question_count: number;
    player_count: number;
    active: boolean;
    completed: boolean;
  }) {
    this.host = props.host;
    this.question_count = props.question_count;
    this.player_count = props.player_count;
    this.active = props.active;
    this.completed = props.completed;
  }

  static schema = new Map([
    [
      QuizSession,
      {
        kind: "struct",
        fields: [
          ["host", [32]],
          ["question_count", "u8"],
          ["player_count", "u8"],
          ["active", "u8"], // Rust bool serializes as u8
          ["completed", "u8"], // Rust bool serializes as u8
        ],
      },
    ],
  ]);

  static deserialize(data: Buffer): QuizSession {
    try {
      const result = borsh.deserialize(QuizSession.schema, QuizSession, data);
      // Convert u8 boolean values back to boolean
      const session = result as any;
      return new QuizSession({
        host: session.host,
        question_count: session.question_count,
        player_count: session.player_count,
        active: Boolean(session.active),
        completed: Boolean(session.completed),
      });
    } catch (error) {
      console.error("Failed to deserialize QuizSession:", error);
      throw error;
    }
  }
}

export class PlayerAnswer {
  player: Uint8Array;
  answers: number[];

  constructor(props: { player: Uint8Array; answers: number[] }) {
    this.player = props.player;
    this.answers = props.answers;
  }

  static schema = new Map([
    [
      PlayerAnswer,
      {
        kind: "struct",
        fields: [
          ["player", [32]],
          ["answers", ["u8"]],
        ],
      },
    ],
  ]);

  static deserialize(data: Buffer): PlayerAnswer {
    try {
      const result = borsh.deserialize(PlayerAnswer.schema, PlayerAnswer, data);
      return result as PlayerAnswer;
    } catch (error) {
      console.error("Failed to deserialize PlayerAnswer:", error);
      throw error;
    }
  }
}

export class PlayerScore {
  player: Uint8Array;
  score: number;

  constructor(props: { player: Uint8Array; score: number }) {
    this.player = props.player;
    this.score = props.score;
  }

  static schema = new Map([
    [
      PlayerScore,
      {
        kind: "struct",
        fields: [
          ["player", [32]],
          ["score", "u8"],
        ],
      },
    ],
  ]);

  static deserialize(data: Buffer): PlayerScore {
    try {
      const result = borsh.deserialize(PlayerScore.schema, PlayerScore, data);
      return result as PlayerScore;
    } catch (error) {
      console.error("Failed to deserialize PlayerScore:", error);
      throw error;
    }
  }
}

// Instruction argument classes
export class AddQuestionData {
  question_index: number;
  question_text: string;
  options: [string, string, string, string];
  correct_answer_index: number;

  constructor(props: {
    question_index: number;
    question_text: string;
    options: [string, string, string, string];
    correct_answer_index: number;
  }) {
    this.question_index = props.question_index;
    this.question_text = props.question_text;
    this.options = props.options;
    this.correct_answer_index = props.correct_answer_index;
  }

  static schema = new Map([
    [
      AddQuestionData,
      {
        kind: "struct",
        fields: [
          ["question_index", "u8"],
          ["question_text", "string"],
          ["options", ["string", 4]],
          ["correct_answer_index", "u8"],
        ],
      },
    ],
  ]);
}

export class InitializeQuizArgs {
  instruction: Uint8Array;
  question_count: number;

  constructor(props: { question_count: number }) {
    this.instruction = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]); // 8-byte discriminator
    this.question_count = props.question_count;
  }

  serialize(): Buffer {
    try {
      const instrBuffer = Buffer.from(this.instruction);
      const questionCountBuffer = Buffer.from([this.question_count]);
      return Buffer.concat([instrBuffer, questionCountBuffer]);
    } catch (error) {
      console.error("Failed to serialize InitializeQuizArgs:", error);
      throw error;
    }
  }
}

export class AddQuestionArgs {
  instruction: Uint8Array;
  question_index: number;
  question_text: string;
  options: [string, string, string, string];
  correct_answer_index: number;

  constructor(props: {
    question_index: number;
    question_text: string;
    options: [string, string, string, string];
    correct_answer_index: number;
  }) {
    this.instruction = new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0]); // 8-byte discriminator
    this.question_index = props.question_index;
    this.question_text = props.question_text;
    this.options = props.options;
    this.correct_answer_index = props.correct_answer_index;
  }

  serialize(): Buffer {
    try {
      const instrBuffer = Buffer.from(this.instruction);

      // Create AddQuestionData object for serialization
      const questionData = new AddQuestionData({
        question_index: this.question_index,
        question_text: this.question_text,
        options: this.options,
        correct_answer_index: this.correct_answer_index,
      });

      // Serialize using the AddQuestionData schema
      const dataBuffer = Buffer.from(
        borsh.serialize(AddQuestionData.schema, questionData)
      );
      return Buffer.concat([instrBuffer, dataBuffer]);
    } catch (error) {
      console.error("Failed to serialize AddQuestionArgs:", error);
      throw error;
    }
  }
}

export class StartQuizArgs {
  instruction: Uint8Array;

  constructor() {
    this.instruction = new Uint8Array([2, 0, 0, 0, 0, 0, 0, 0]); // 8-byte discriminator
  }

  serialize(): Buffer {
    try {
      return Buffer.from(this.instruction);
    } catch (error) {
      console.error("Failed to serialize StartQuizArgs:", error);
      throw error;
    }
  }
}

export class DelegateArgs {
  instruction: Uint8Array;

  constructor() {
    this.instruction = new Uint8Array([3, 0, 0, 0, 0, 0, 0, 0]); // 8-byte discriminator
  }

  serialize(): Buffer {
    try {
      return Buffer.from(this.instruction);
    } catch (error) {
      console.error("Failed to serialize DelegateArgs:", error);
      throw error;
    }
  }
}

export class SubmitAnswersArgs {
  instruction: Uint8Array;
  answers: number[];

  constructor(props: { answers: number[] }) {
    this.instruction = new Uint8Array([4, 0, 0, 0, 0, 0, 0, 0]); // 8-byte discriminator
    this.answers = props.answers;
  }

  serialize(): Buffer {
    try {
      const instrBuffer = Buffer.from(this.instruction);
      // Borsh Vec<u8> serialization: length (4 bytes little-endian) + data
      const lengthBuffer = Buffer.alloc(4);
      lengthBuffer.writeUInt32LE(this.answers.length, 0);
      const answersBuffer = Buffer.from(this.answers);
      return Buffer.concat([instrBuffer, lengthBuffer, answersBuffer]);
    } catch (error) {
      console.error("Failed to serialize SubmitAnswersArgs:", error);
      throw error;
    }
  }
}

export class CommitAnswersArgs {
  instruction: Uint8Array;

  constructor() {
    this.instruction = new Uint8Array([5, 0, 0, 0, 0, 0, 0, 0]); // 8-byte discriminator
  }

  serialize(): Buffer {
    try {
      return Buffer.from(this.instruction);
    } catch (error) {
      console.error("Failed to serialize CommitAnswersArgs:", error);
      throw error;
    }
  }
}

export class CalculateScoresArgs {
  instruction: Uint8Array;

  constructor() {
    this.instruction = new Uint8Array([6, 0, 0, 0, 0, 0, 0, 0]); // 8-byte discriminator
  }

  serialize(): Buffer {
    try {
      return Buffer.from(this.instruction);
    } catch (error) {
      console.error("Failed to serialize CalculateScoresArgs:", error);
      throw error;
    }
  }
}
