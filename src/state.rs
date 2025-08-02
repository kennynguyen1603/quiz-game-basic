use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct QuizQuestion {
    pub question_text: String,
    pub options: [String; 4],
    pub correct_answer_index: u8,
}

impl QuizQuestion {
    pub fn get_size(question_text: &str, options: &[String; 4]) -> usize {
        let question_text_size = question_text.len() + 4;
        let options_size: usize = options.iter().map(|s| s.len() + 4).sum();
        question_text_size + options_size + 1
    }
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct QuizSession {
    pub host: Pubkey,
    pub question_count: u8,
    pub player_count: u8,
    pub active: bool,
    pub completed: bool,
}

impl QuizSession {
    pub const SIZE: usize = 32 + 1 + 1 + 1 + 1; // host + question_count + player_count + active + completed
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct PlayerAnswer {
    pub player: Pubkey,
    pub answers: Vec<u8>,
}

impl PlayerAnswer {
    pub fn get_size(answer_count: usize) -> usize {
        32 + // player pubkey
        4 + // vec length
        answer_count // u8 for each answer
    }
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct PlayerScore {
    pub player: Pubkey,
    pub score: u8,
}

impl PlayerScore {
    pub const SIZE: usize = 32 + 1; // 33 bytes
}
