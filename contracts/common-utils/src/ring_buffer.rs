//! Bounded-history ring-buffer storage helpers for Soroban contracts.

use soroban_sdk::{Env, IntoVal, TryFromVal, Val, Vec};

/// Stateless storage helper for maintaining bounded history buffers.
pub struct RingBuffer;

impl RingBuffer {
    /// Appends an item to a bounded vector, dropping oldest elements if capacity is exceeded.
    pub fn push<T>(env: &Env, buffer: &mut Vec<T>, item: T, capacity: u32)
    where
        T: IntoVal<Env, Val> + TryFromVal<Env, Val>,
    {
        buffer.push_back(item);
        if buffer.len() > capacity {
            let overflow = buffer.len() - capacity;
            let mut trimmed = Vec::new(env);
            let mut i = overflow;
            while i < buffer.len() {
                trimmed.push_back(buffer.get(i).unwrap());
                i += 1;
            }
            *buffer = trimmed;
        }
    }

    /// Returns the most recent N items from the buffer.
    pub fn latest<T>(env: &Env, buffer: &Vec<T>, count: u32) -> Vec<T>
    where
        T: IntoVal<Env, Val> + TryFromVal<Env, Val>,
    {
        let total = buffer.len();
        if count >= total {
            return buffer.clone();
        }
        let start = total - count;
        let mut result = Vec::new(env);
        let mut i = start;
        while i < total {
            result.push_back(buffer.get(i).unwrap());
            i += 1;
        }
        result
    }
}

/// Bounded collection helper managing fixed-capacity item buffers.
#[derive(Clone)]
pub struct BoundedBuffer<T> {
    items: Vec<T>,
    capacity: u32,
}

impl<T> BoundedBuffer<T>
where
    T: IntoVal<Env, Val> + TryFromVal<Env, Val>,
{
    /// Creates an empty bounded buffer with the specified maximum capacity.
    pub fn new(env: &Env, capacity: u32) -> Self {
        Self {
            items: Vec::new(env),
            capacity,
        }
    }

    /// Wraps an existing Soroban vector into a bounded buffer.
    pub fn from_vec(items: Vec<T>, capacity: u32) -> Self {
        Self { items, capacity }
    }

    /// Appends an item, truncating oldest records if capacity is exceeded.
    pub fn push(&mut self, env: &Env, item: T) {
        RingBuffer::push(env, &mut self.items, item, self.capacity);
    }

    /// Returns the underlying Soroban vector.
    pub fn items(&self) -> Vec<T> {
        self.items.clone()
    }

    /// Returns the number of items currently stored in the buffer.
    pub fn len(&self) -> u32 {
        self.items.len()
    }

    /// Returns true if the buffer contains no items.
    pub fn is_empty(&self) -> bool {
        self.items.is_empty()
    }

    /// Returns the maximum capacity of the buffer.
    pub fn capacity(&self) -> u32 {
        self.capacity
    }

    /// Retrieves an item at a specific index if within bounds.
    pub fn get(&self, index: u32) -> Option<T> {
        self.items.get(index)
    }

    /// Returns the most recent N items.
    pub fn latest(&self, env: &Env, count: u32) -> Vec<T> {
        RingBuffer::latest(env, &self.items, count)
    }
}
