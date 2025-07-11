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
}