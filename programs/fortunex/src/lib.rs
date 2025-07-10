use anchor_lang::prelude::*;

declare_id!("HZVuaH9kwqbcaDbntydUn9gjus9dT1LuCvXgGK2e3b21");

#[program]
pub mod fortunex {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
