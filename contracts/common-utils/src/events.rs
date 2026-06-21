use soroban_sdk::{symbol_short, Env, Symbol, Vec};

/// Event emission helper utilities
pub struct EventHelpers;

impl EventHelpers {
    /// Emit a simple event with one topic
    ///
    /// # Example
    /// ```
    /// EventHelpers::emit_1(&env, symbol_short!("transfer"), &amount);
    /// ```
    pub fn emit_1<T>(env: &Env, topic: Symbol, data: &T)
    where
        T: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
    {
        let topics = (topic,);
        env.events().publish(topics, data.clone());
    }

    /// Emit event with two topics
    pub fn emit_2<T>(env: &Env, topic1: Symbol, topic2: Symbol, data: &T)
    where
        T: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
    {
        let topics = (topic1, topic2);
        env.events().publish(topics, data.clone());
    }

    /// Emit event with three topics
    pub fn emit_3<T>(env: &Env, topic1: Symbol, topic2: Symbol, topic3: Symbol, data: &T)
    where
        T: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
    {
        let topics = (topic1, topic2, topic3);
        env.events().publish(topics, data.clone());
    }

    /// Emit event with four topics
    pub fn emit_4<T>(
        env: &Env,
        topic1: Symbol,
        topic2: Symbol,
        topic3: Symbol,
        topic4: Symbol,
        data: &T,
    ) where
        T: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
    {
        let topics = (topic1, topic2, topic3, topic4);
        env.events().publish(topics, data.clone());
    }
}

/// Standard event types for common operations
pub struct StandardEvents;

impl StandardEvents {
    /// Emit transfer event
    pub fn transfer(
        env: &Env,
        from: &soroban_sdk::Address,
        to: &soroban_sdk::Address,
        amount: i128,
    ) {
        let topics = (symbol_short!("transfer"), from.clone(), to.clone());
        env.events().publish(topics, amount);
    }

    /// Emit approval event
    pub fn approval(
        env: &Env,
        owner: &soroban_sdk::Address,
        spender: &soroban_sdk::Address,
        amount: i128,
    ) {
        let topics = (symbol_short!("approval"), owner.clone(), spender.clone());
        env.events().publish(topics, amount);
    }

    /// Emit ownership transfer event
    pub fn ownership_transferred(
        env: &Env,
        previous: &soroban_sdk::Address,
        new: &soroban_sdk::Address,
    ) {
        let topics = (symbol_short!("own_xfer"), previous.clone());
        env.events().publish(topics, new.clone());
    }

    /// Emit paused event
    pub fn paused(env: &Env, by: &soroban_sdk::Address) {
        let topics = (symbol_short!("paused"),);
        env.events().publish(topics, by.clone());
    }

    /// Emit unpaused event
    pub fn unpaused(env: &Env, by: &soroban_sdk::Address) {
        let topics = (symbol_short!("unpaused"),);
        env.events().publish(topics, by.clone());
    }

    /// Emit role granted event
    pub fn role_granted(
        env: &Env,
        role: Symbol,
        account: &soroban_sdk::Address,
        sender: &soroban_sdk::Address,
    ) {
        let topics = (symbol_short!("role_grt"), role, account.clone());
        env.events().publish(topics, sender.clone());
    }

    /// Emit role revoked event
    pub fn role_revoked(
        env: &Env,
        role: Symbol,
        account: &soroban_sdk::Address,
        sender: &soroban_sdk::Address,
    ) {
        let topics = (symbol_short!("role_rev"), role, account.clone());
        env.events().publish(topics, sender.clone());
    }

    /// Emit generic update event
    pub fn updated(env: &Env, key: Symbol, old_value: i128, new_value: i128) {
        let topics = (symbol_short!("updated"), key);
        let data = (old_value, new_value);
        env.events().publish(topics, data);
    }

    /// Emit error event
    pub fn error(env: &Env, error_code: u32, message: Symbol) {
        let topics = (symbol_short!("error"),);
        let data = (error_code, message);
        env.events().publish(topics, data);
    }
}

/// Event builder for complex events
pub struct EventBuilder {
    topics: Vec<Symbol>,
}

impl EventBuilder {
    /// Create a new event builder
    pub fn new(env: &Env) -> Self {
        Self {
            topics: Vec::new(env),
        }
    }

    /// Add a topic to the event
    pub fn topic(mut self, topic: Symbol) -> Self {
        self.topics.push_back(topic);
        self
    }

    /// Emit the event with data
    pub fn emit<T>(self, env: &Env, data: T)
    where
        T: soroban_sdk::IntoVal<Env, soroban_sdk::Val>,
    {
        // Note: Soroban SDK requires tuple topics, so this is a simplified version
        // In practice, you'd need to match on topics.len() and create appropriate tuples
        if self.topics.len() == 1 {
            let topic = self.topics.get(0).unwrap();
            env.events().publish((topic,), data);
        }
    }
}
