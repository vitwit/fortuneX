use anchor_lang::prelude::*;

#[error_code]
pub enum FortuneXError {
    #[msg("Pool is not active")]
    PoolNotActive,
    #[msg("Draw time not reached")]
    DrawTimeNotReached,
    #[msg("Pool is full")]
    PoolFull,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Invalid ticket amount")]
    InvalidTicketAmount,
    #[msg("Pool already drawing")]
    PoolAlreadyDrawing,
    #[msg("No participants in pool")]
    NoParticipants,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid random seed")]
    InvalidRandomSeed,
    #[msg("Draw already completed")]
    DrawAlreadyCompleted,
    #[msg("User already has ticket")]
    UserAlreadyHasTicket,
    #[msg("All tickets sold")]
    AllTicketsSold,
    #[msg("Invalid draw interval")]
    InvalidDrawInterval,
    #[msg("Invalid platform fee")]
    InvalidPlatformFee,
    #[msg("Creator is already whitelisted")]
    CreatorAlreadyWhitelisted,
    #[msg("Whitelist is full")]
    WhitelistFull,
    #[msg("Creator is not whitelisted")]
    CreatorNotWhitelisted,
    #[msg("Only whitelisted creators can create pools")]
    CreatorNotAllowed,
    #[msg("Arithmetic overflow occurred")]
    Overflow,
    #[msg("Already participating")]
    UserAlreadyParticipating,
    #[msg("Pool not ready for draw")]
    PoolNotReadyForDraw,
    #[msg("Pool not full")]
    PoolNotFull,
    #[msg("Winner token account not found")]
    WinnerTokenAccountNotFound,
    #[msg("Invalid remaining accounts")]
    InvalidRemainingAccounts,
    #[msg("Invalid token account")]
    InvalidTokenAccount,

    #[msg("Invalid winner token account")]
    InvalidWinnerTokenAccount,

    #[msg("Invalid number of remaining accounts")]
    InvalidRemainingAccountsCount,
}
