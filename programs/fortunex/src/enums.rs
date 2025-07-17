use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq, InitSpace)]
pub enum PoolStatus {
    Active,       // Pool is accepting tickets
    ReadyForDraw, // Pool filled
    Completed,    // Draw completed
}
