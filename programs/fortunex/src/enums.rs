use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq, InitSpace)]
pub enum PoolStatus {
    Active,      // Pool is accepting tickets
    Completed,   // Draw completed
}