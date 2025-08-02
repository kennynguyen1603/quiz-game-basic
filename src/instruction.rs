use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::program_error::ProgramError;

use crate::state::QuizQuestion;

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct AddQuestionData {
    pub question_index: u8,
    pub question_text: String,
    pub options: [String; 4],
    pub correct_answer_index: u8,
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum QuizInstruction {
    InitializeQuiz {
        question_count: u8,
    },
    AddQuestion {
        question_index: u8,
        question_text: String,
        options: [String; 4],
        correct_answer_index: u8,
    },
    StartQuiz,
    DelegatePlayer,
    SubmitAnswers {
        answers: Vec<u8>,
    },
    CommitAnswers,
    CalculateScores,
    UndelegatePlayer {
        pda_seeds: Vec<Vec<u8>>,
    },
}

impl QuizInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        if input.len() < 8 {
            return Err(ProgramError::InvalidInstructionData);
        }

        let (ix_discriminator, rest) = input.split_at(8);

        Ok(match ix_discriminator {
            [0, 0, 0, 0, 0, 0, 0, 0] => {
                if rest.is_empty() {
                    return Err(ProgramError::InvalidInstructionData);
                }
                let question_count = rest[0];
                Self::InitializeQuiz { question_count }
            }
            [1, 0, 0, 0, 0, 0, 0, 0] => {
                let question_data = AddQuestionData::try_from_slice(rest)?;
                Self::AddQuestion {
                    question_index: question_data.question_index,
                    question_text: question_data.question_text,
                    options: question_data.options,
                    correct_answer_index: question_data.correct_answer_index,
                }
            }
            [2, 0, 0, 0, 0, 0, 0, 0] => Self::StartQuiz,
            [3, 0, 0, 0, 0, 0, 0, 0] => Self::DelegatePlayer,
            [4, 0, 0, 0, 0, 0, 0, 0] => {
                let answers = Vec::<u8>::try_from_slice(rest)?;
                Self::SubmitAnswers { answers }
            }
            [5, 0, 0, 0, 0, 0, 0, 0] => Self::CommitAnswers,
            [6, 0, 0, 0, 0, 0, 0, 0] => Self::CalculateScores,
            [7, 0, 0, 0, 0, 0, 0, 0] => {
                let pda_seeds = Vec::<Vec<u8>>::try_from_slice(rest)?;
                Self::UndelegatePlayer { pda_seeds }
            }
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}
