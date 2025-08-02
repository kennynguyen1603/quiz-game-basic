use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    system_instruction,
    sysvar::rent::Rent,
    sysvar::Sysvar,
};

use ephemeral_rollups_sdk::cpi::{
    delegate_account, undelegate_account, DelegateAccounts, DelegateConfig,
};
use ephemeral_rollups_sdk::ephem::commit_accounts;

use crate::{
    instruction::QuizInstruction,
    state::{PlayerAnswer, PlayerScore, QuizQuestion, QuizSession},
};

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = QuizInstruction::unpack(instruction_data)?;

    match instruction {
        QuizInstruction::InitializeQuiz { question_count } => {
            process_initialize_quiz(program_id, accounts, question_count)
        }
        QuizInstruction::AddQuestion {
            question_index,
            question_text,
            options,
            correct_answer_index,
        } => process_add_question(
            program_id,
            accounts,
            question_index,
            question_text,
            options,
            correct_answer_index,
        ),
        QuizInstruction::StartQuiz => process_start_quiz(program_id, accounts),
        QuizInstruction::DelegatePlayer => process_delegate_player(program_id, accounts),
        QuizInstruction::SubmitAnswers { answers } => {
            process_submit_answers(program_id, accounts, answers)
        }
        QuizInstruction::CommitAnswers => process_commit_answers(program_id, accounts),
        QuizInstruction::CalculateScores => process_calculate_scores(program_id, accounts),
        QuizInstruction::UndelegatePlayer { pda_seeds } => {
            process_undelegate_player(program_id, accounts, pda_seeds)
        }
    }
}

pub fn process_initialize_quiz(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    question_count: u8,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let host_account = next_account_info(accounts_iter)?;
    let quiz_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;

    // Verify host is signer
    if !host_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Derive quiz session PDA
    let (quiz_pda, bump_seed) =
        Pubkey::find_program_address(&[b"quiz_session", host_account.key.as_ref()], program_id);

    // Verify PDA matches provided account
    if quiz_pda != *quiz_account.key {
        return Err(ProgramError::InvalidArgument);
    }

    // Create quiz session account
    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(QuizSession::SIZE);

    invoke_signed(
        &system_instruction::create_account(
            host_account.key,
            quiz_account.key,
            rent_lamports,
            QuizSession::SIZE as u64,
            program_id,
        ),
        &[
            host_account.clone(),
            quiz_account.clone(),
            system_program.clone(),
        ],
        &[&[b"quiz_session", host_account.key.as_ref(), &[bump_seed]]],
    )?;

    // Initialize quiz session data
    let quiz_data = QuizSession {
        host: *host_account.key,
        question_count,
        player_count: 0,
        active: false,
        completed: false,
    };

    quiz_data.serialize(&mut &mut quiz_account.data.borrow_mut()[..])?;
    msg!("Quiz session initialized with {} questions", question_count);

    Ok(())
}

pub fn process_add_question(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    question_index: u8,
    question_text: String,
    options: [String; 4],
    correct_answer_index: u8,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let host_account = next_account_info(accounts_iter)?;
    let quiz_account = next_account_info(accounts_iter)?;
    let question_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;

    // Verify host is signer
    if !host_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify host is the quiz creator
    let quiz_data = QuizSession::try_from_slice(&quiz_account.data.borrow())?;
    if quiz_data.host != *host_account.key {
        return Err(ProgramError::InvalidAccountData);
    }

    // Verify quiz is not active yet
    if quiz_data.active {
        return Err(ProgramError::InvalidAccountData);
    }

    // Extract question index from instruction
    // let question_index = question_account.key.to_bytes()[0]; // Old buggy code
    // Use question_index from instruction parameter instead

    // Derive question PDA
    let (question_pda, bump_seed) = Pubkey::find_program_address(
        &[
            b"quiz_question",
            quiz_account.key.as_ref(),
            &[question_index],
        ],
        program_id,
    );

    // Verify PDA matches provided account
    if question_pda != *question_account.key {
        return Err(ProgramError::InvalidArgument);
    }

    // Create question account
    let account_size = QuizQuestion::get_size(&question_text, &options);
    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(account_size);

    invoke_signed(
        &system_instruction::create_account(
            host_account.key,
            question_account.key,
            rent_lamports,
            account_size as u64,
            program_id,
        ),
        &[
            host_account.clone(),
            question_account.clone(),
            system_program.clone(),
        ],
        &[&[
            b"quiz_question",
            quiz_account.key.as_ref(),
            &[question_index],
            &[bump_seed],
        ]],
    )?;

    // Initialize question data
    let question_data = QuizQuestion {
        question_text,
        options,
        correct_answer_index,
    };

    question_data.serialize(&mut &mut question_account.data.borrow_mut()[..])?;
    msg!("Quiz question {} added", question_index);

    Ok(())
}

pub fn process_start_quiz(_program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let host_account = next_account_info(accounts_iter)?;
    let quiz_account = next_account_info(accounts_iter)?;

    // Verify host is signer
    if !host_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify host is the quiz creator
    let mut quiz_data = QuizSession::try_from_slice(&quiz_account.data.borrow())?;
    if quiz_data.host != *host_account.key {
        return Err(ProgramError::InvalidAccountData);
    }

    // Set quiz as active
    quiz_data.active = true;
    quiz_data.serialize(&mut &mut quiz_account.data.borrow_mut()[..])?;

    msg!("Quiz started and open for players");
    Ok(())
}

pub fn process_delegate_player(_program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_iter = &mut accounts.iter();

    let player = next_account_info(account_iter)?;
    let system_program = next_account_info(account_iter)?;
    let player_answer_account = next_account_info(account_iter)?;
    let owner_program = next_account_info(account_iter)?;
    let delegation_buffer = next_account_info(account_iter)?;
    let delegation_record = next_account_info(account_iter)?;
    let delegation_metadata = next_account_info(account_iter)?;
    let delegation_program = next_account_info(account_iter)?;
    let quiz_account = next_account_info(account_iter)?;

    // Verify player is signer
    if !player.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify quiz is active
    let mut quiz_data = QuizSession::try_from_slice(&quiz_account.data.borrow())?;
    if !quiz_data.active || quiz_data.completed {
        return Err(ProgramError::InvalidAccountData);
    }

    // Increment player count
    quiz_data.player_count += 1;
    quiz_data.serialize(&mut &mut quiz_account.data.borrow_mut()[..])?;

    // Prepare player answer PDA seeds
    let seed_1 = b"player_answer";
    let seed_2 = quiz_account.key.as_ref();
    let seed_3 = player.key.as_ref();
    let pda_seeds: &[&[u8]] = &[seed_1, seed_2, seed_3];

    // Set up delegation
    let delegate_accounts = DelegateAccounts {
        payer: player,
        pda: player_answer_account,
        owner_program,
        buffer: delegation_buffer,
        delegation_record,
        delegation_metadata,
        delegation_program,
        system_program,
    };

    let delegate_config = DelegateConfig {
        commit_frequency_ms: 1000,          // Commit every 1 second
        validator: Some(Pubkey::default()), // Use default pubkey for now
    };

    delegate_account(delegate_accounts, pda_seeds, delegate_config)?;
    msg!("Player {} delegated to participate in quiz", player.key);

    Ok(())
}

pub fn process_submit_answers(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    answers: Vec<u8>,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let player_account = next_account_info(accounts_iter)?;
    let player_answer_account = next_account_info(accounts_iter)?;
    let quiz_account = next_account_info(accounts_iter)?;

    // Verify player is signer
    if !player_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify quiz is active
    let quiz_data = QuizSession::try_from_slice(&quiz_account.data.borrow())?;
    if !quiz_data.active || quiz_data.completed {
        return Err(ProgramError::InvalidAccountData);
    }

    // Verify answer count matches question count
    if answers.len() != quiz_data.question_count as usize {
        return Err(ProgramError::InvalidInstructionData);
    }

    // Create player answers data
    let player_answers = PlayerAnswer {
        player: *player_account.key,
        answers,
    };

    // Save answers to delegated account
    player_answers.serialize(&mut &mut player_answer_account.data.borrow_mut()[..])?;

    msg!("Player {} submitted answers", player_account.key);
    Ok(())
}

pub fn process_commit_answers(_program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let host_account = next_account_info(accounts_iter)?;
    let quiz_account = next_account_info(accounts_iter)?;
    let magic_program = next_account_info(accounts_iter)?;
    let magic_context = next_account_info(accounts_iter)?;

    // Verify host is signer
    if !host_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify host is the quiz creator
    let quiz_data = QuizSession::try_from_slice(&quiz_account.data.borrow())?;
    if quiz_data.host != *host_account.key {
        return Err(ProgramError::InvalidAccountData);
    }

    // Commit answers from ephemeral rollup to Solana
    commit_accounts(magic_program, vec![], magic_context, magic_context)?;

    msg!("Player answers committed to chain");
    Ok(())
}

pub fn process_calculate_scores(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let host_account = next_account_info(accounts_iter)?;
    let quiz_account = next_account_info(accounts_iter)?;

    // Verify host is signer
    if !host_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify host is the quiz creator
    let mut quiz_data = QuizSession::try_from_slice(&quiz_account.data.borrow())?;
    if quiz_data.host != *host_account.key {
        return Err(ProgramError::InvalidAccountData);
    }

    // Get question accounts
    let mut questions = Vec::with_capacity(quiz_data.question_count as usize);
    for _ in 0..quiz_data.question_count {
        let question_account = next_account_info(accounts_iter)?;
        let question = QuizQuestion::try_from_slice(&question_account.data.borrow())?;
        questions.push(question);
    }

    // Process each player's answers
    for _ in 0..quiz_data.player_count {
        let player_answer_account = next_account_info(accounts_iter)?;
        let player_score_account = next_account_info(accounts_iter)?;
        let system_program = next_account_info(accounts_iter)?;

        // Get player answers
        let player_answer = PlayerAnswer::try_from_slice(&player_answer_account.data.borrow())?;

        // Calculate score
        let mut score: u8 = 0;
        for (i, &answer_idx) in player_answer.answers.iter().enumerate() {
            if i < questions.len() && answer_idx == questions[i].correct_answer_index {
                score += 1;
            }
        }

        // Create score account
        let (score_pda, bump_seed) = Pubkey::find_program_address(
            &[
                b"player_score",
                quiz_account.key.as_ref(),
                player_answer.player.as_ref(),
            ],
            program_id,
        );

        // Verify PDA matches provided account
        if score_pda != *player_score_account.key {
            return Err(ProgramError::InvalidArgument);
        }

        // Create score account
        let rent = Rent::get()?;
        let rent_lamports = rent.minimum_balance(PlayerScore::SIZE);

        invoke_signed(
            &system_instruction::create_account(
                host_account.key,
                player_score_account.key,
                rent_lamports,
                PlayerScore::SIZE as u64,
                program_id,
            ),
            &[
                host_account.clone(),
                player_score_account.clone(),
                system_program.clone(),
            ],
            &[&[
                b"player_score",
                quiz_account.key.as_ref(),
                player_answer.player.as_ref(),
                &[bump_seed],
            ]],
        )?;

        // Save player score
        let player_score = PlayerScore {
            player: player_answer.player,
            score,
        };
        player_score.serialize(&mut &mut player_score_account.data.borrow_mut()[..])?;

        msg!(
            "Player {} scored {} out of {}",
            player_answer.player,
            score,
            questions.len()
        );
    }

    // Mark quiz as completed
    quiz_data.completed = true;
    quiz_data.serialize(&mut &mut quiz_account.data.borrow_mut()[..])?;

    msg!("Quiz completed and scores calculated");
    Ok(())
}

pub fn process_undelegate_player(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    pda_seeds: Vec<Vec<u8>>,
) -> ProgramResult {
    let account_iter = &mut accounts.iter();

    let player_answer_account = next_account_info(account_iter)?;
    let delegation_buffer = next_account_info(account_iter)?;
    let player = next_account_info(account_iter)?;
    let system_program = next_account_info(account_iter)?;

    // Verify player is signer
    if !player.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Undelegate player account
    undelegate_account(
        player_answer_account,
        player_answer_account.key,
        player,
        system_program,
        delegation_buffer,
        pda_seeds,
    )?;

    msg!("Player {} undelegated from quiz", player.key);
    Ok(())
}
