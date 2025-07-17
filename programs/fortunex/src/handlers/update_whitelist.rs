use crate::instructions::UpdateWhitelist;
use crate::{FortuneXError, GlobalState};
use anchor_lang::prelude::*;

pub fn update_whitelist(ctx: Context<UpdateWhitelist>, is_add: bool) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;
    let creator_key = ctx.accounts.creator.key();

    if is_add {
        // Add creator to whitelist
        require!(
            !global_state.creators_whitelist.contains(&creator_key),
            FortuneXError::CreatorAlreadyWhitelisted
        );
        require!(
            global_state.creators_whitelist.len() < GlobalState::MAX_CREATORS,
            FortuneXError::WhitelistFull
        );

        global_state.creators_whitelist.push(creator_key);

        msg!("Creator {} added to whitelist", creator_key);
    } else {
        // Remove creator from whitelist
        if let Some(pos) = global_state
            .creators_whitelist
            .iter()
            .position(|x| x == &creator_key)
        {
            global_state.creators_whitelist.remove(pos);
            msg!("Creator {} removed from whitelist", creator_key);
        } else {
            return Err(FortuneXError::CreatorNotWhitelisted.into());
        }
    }

    Ok(())
}
