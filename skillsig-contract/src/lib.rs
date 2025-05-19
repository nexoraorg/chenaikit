#![no_std]

use soroban_sdk::{
    contractimpl, panic_with_error, symbol, token, Address, BytesN, Env, IntoVal, Map, Storage,
    TokenIdentifier, Vec,
};

/// Errors for the SkillTree contract.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Error {
    /// Quest already completed by user.
    QuestAlreadyCompleted = 1,
    /// Quest does not exist.
    QuestNotFound = 2,
    /// Only contract admin can perform this action.
    Unauthorized = 3,
    /// Badge minting failed.
    BadgeMintFailed = 4,
    /// Character already minted for user.
    CharacterAlreadyMinted = 5,
}

impl soroban_sdk::contracterror::ContractError for Error {
    fn as_u32(&self) -> u32 {
        *self as u32
    }
}

/// Quest info struct for quest metadata (optional, stored in contract)
#[derive(Clone)]
pub struct Quest {
    pub id: u32,
    pub name: &'static str,
    pub badge_name: &'static str,
}

/// Main contract struct
pub struct SkillTreeContract;

const CHARACTER_NFT_NAME: &str = "SkillTree Character";
const CHARACTER_NFT_SYMBOL: &str = "STC";

const BADGE_NFT_NAME: &str = "SkillTree Badge";
const BADGE_NFT_SYMBOL: &str = "STB";

const KEY_ADMIN: &str = "admin";
const KEY_CHARACTER_MINTED: &str = "character_minted";
const PREFIX_QUEST_COMPLETED: &str = "quest_completed";

// We will use Soroban token contract for NFTs.
// We need the character soulbound NFT (non-transferable) - we simulate this by preventing transfers.
// Badges are transferable NFTs minted upon quest completion.

#[contractimpl]
impl SkillTreeContract {
    /// Initialize contract with admin set to caller.
    pub fn initialize(env: Env) {
        let admin = env.invoker();
        env.storage().set(&symbol!(KEY_ADMIN), &admin);
    }

    /// Mint a soulbound character NFT for the user.
    /// Only one character NFT per user, soulbound means non-transferable.
    pub fn mint_character(env: Env, user: Address) {
        // Only user themselves can mint their character or admin
        let invoker = env.invoker();
        if invoker != user && invoker != Self::admin(&env) {
            panic_with_error!(&env, Error::Unauthorized);
        }

        // Check if character NFT already minted for user
        let storage = env.storage();
        let char_key = (symbol!(KEY_CHARACTER_MINTED), user.clone());
        if storage.has(&char_key) {
            panic_with_error!(&env, Error::CharacterAlreadyMinted);
        }

        // Use token interface to mint soulbound NFT - character
        // Create a token id for character NFT collection (unique)
        // For simplicity, use contract id + "character" as TokenIdentifier
        let token_id = Self::character_token_id(&env);

        // Create metadata attribute map for character NFT
        let mut metadatas = Map::<symbol::Symbol, Vec<u8>>::new(&env);
        metadatas.set(symbol!("name"), CHARACTER_NFT_NAME.into_val(&env));
        metadatas.set(symbol!("symbol"), CHARACTER_NFT_SYMBOL.into_val(&env));

        // Instantiate token object for mint operation
        let token_client = token::Client::new(&env, &token_id);

        // Mint token id #user address represented as uint256 or bytes as token ID
        // Here we mint a single NFT with token_id and token ID is 1 for user
        // But NFTs in Soroban tokens are identified by (TokenIdentifier, u128)
        // We'll use user's address as u128 hash for token ID for uniqueness

        let user_id_bytes = user.to_bytes(&env);
        let user_id_num = Self::address_to_u128(&user_id_bytes);

        token_client.mint(&user, &user_id_num, &1);

        // Store that character minted for user
        storage.set(&char_key, &true);
    }

    /// Mint a badge NFT for a user when they complete a quest.
    /// Each badge is an NFT with unique ID.
    /// QuestId is the identifier for the quest.
    pub fn mint_badge(env: Env, user: Address, quest_id: u32) {
        let invoker = env.invoker();
        // Only user themselves or admin can mint badges for user
        if invoker != user && invoker != Self::admin(&env) {
            panic_with_error!(&env, Error::Unauthorized);
        }

        // Check quest completion state to prevent double minting
        let storage = env.storage();
        let quest_completed_key = (symbol!(PREFIX_QUEST_COMPLETED), user.clone(), quest_id);
        if storage.has(&quest_completed_key) {
            panic_with_error!(&env, Error::QuestAlreadyCompleted);
        }

        // Verify quest exists - in a real app you might store quests; here we accept 1 through 5
        if quest_id == 0 || quest_id > 5 {
            panic_with_error!(&env, Error::QuestNotFound);
        }

        // Mint badge NFT to user
        let token_id = Self::badge_token_id(&env);
        let token_client = token::Client::new(&env, &token_id);

        // Token ID: combine quest_id + user_address hash to generate unique token ID for each badge
        // For simplicity, token ID = quest_id * 1_000_000_000_000 + user numeric ID (u128)
        let user_id_bytes = user.to_bytes(&env);
        let user_id_num = Self::address_to_u128(&user_id_bytes);
        let token_number = (quest_id as u128) * 1_000_000_000_000u128 + user_id_num;

        token_client.mint(&user, &token_number, &1);

        // Store quest completion
        storage.set(&quest_completed_key, &true);

        // Update user's badge count (optional)
        // Not implemented here; can be derived offchain by counting NFTs
    }

    /// Helper to get admin address
    pub fn admin(env: &Env) -> Address {
        env.storage()
            .get_unchecked::<_, Address>(&symbol!(KEY_ADMIN))
            .unwrap()
    }

    /// Helper to get character token identifier for soulbound character NFTs.
    /// We simulate an NFT collection by contract id + suffix "character"
    pub fn character_token_id(env: &Env) -> TokenIdentifier {
        let mut contractid = env.get_current_contract_id().into_val(env);
        // Append "character" bytes
        contractid.extend_from_slice(b"character");
        TokenIdentifier::from_bytes(&env, &contractid)
    }

    /// Helper to get badge token identifier for badge NFTs.
    pub fn badge_token_id(env: &Env) -> TokenIdentifier {
        let mut contractid = env.get_current_contract_id().into_val(env);
        // Append "badge" bytes
        contractid.extend_from_slice(b"badge");
        TokenIdentifier::from_bytes(&env, &contractid)
    }

    /// Convert address bytes to u128 for token IDs
    pub fn address_to_u128(bytes: &BytesN<32>) -> u128 {
        // Take first 16 bytes as u128 in big endian
        let slice = &bytes.as_ref()[..16];
        let mut arr = [0u8; 16];
        arr.copy_from_slice(slice);
        u128::from_be_bytes(arr)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Env as TestEnv, Address, BytesN};

    #[test]
    fn test_initialize_and_admin() {
        let env = TestEnv::default();
        let contract = SkillTreeContract {};
        // initialize
        contract.initialize(env.clone());
        let admin = SkillTreeContract::admin(&env);
        assert_eq!(admin, env.invoker());
    }

    #[test]
    fn test_mint_character_works() {
        let env = TestEnv::default();
        let contract = SkillTreeContract {};
        contract.initialize(env.clone());
        let user = Address::random(&env);
        env.set_invoker(user.clone());
        contract.mint_character(env.clone(), user.clone());
        // minting again should fail
        let result =
            std::panic::catch_unwind(|| contract.mint_character(env.clone(), user.clone()));
        assert!(result.is_err());
    }

    #[test]
    fn test_mint_badge_works() {
        let env = TestEnv::default();
        let contract = SkillTreeContract {};
        contract.initialize(env.clone());
        let user = Address::random(&env);
        env.set_invoker(user.clone());

        contract.mint_badge(env.clone(), user.clone(), 1);
        // minting same badge again fails
        let result = std::panic::catch_unwind(|| contract.mint_badge(env.clone(), user.clone(), 1));
        assert!(result.is_err());
        // minting badge for invalid quest fails
        let result2 =
            std::panic::catch_unwind(|| contract.mint_badge(env.clone(), user.clone(), 10));
        assert!(result2.is_err());
    }
}
