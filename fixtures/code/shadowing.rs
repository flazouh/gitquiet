//! Every case the Rust vocabulary has to get right, in one file.
//!
//! Read by src/ledger/dialects/rust.test.ts and by a person. What is here
//! rather than in shadowing.ts is what Rust binds through a pattern: a `match`
//! arm, an `if let`, a `for`, and a closure — each of which holds what it binds
//! to itself.

use std::collections::HashMap;
use std::io::Read as Reader;

const LIMIT: i32 = 10;

struct Box {
    size: i32,
}

enum Shape {
    Round,
    Square,
}

trait Drawable {
    fn area(&self) -> i32;
}

impl Box {
    fn draw(&self, n: i32) -> i32 {
        area(n) + self.size
    }
}

fn area(shape: i32) -> i32 {
    let total = shape * 2;
    let mut sum = total;
    for row in 0..3 {
        sum += row;
    }
    if let Some(found) = maybe() {
        sum += found;
    }
    match shape {
        picked => sum + picked,
    }
}

fn generic<T: Clone>(item: T) -> T {
    item
}

fn sided<const SIDES: usize, T: Clone>(item: T) -> usize {
    let _ = item;
    SIDES
}

fn maybe() -> Option<i32> {
    None
}

fn main() {
    let doubled = |z: i32| z * 2;
    let _ = doubled(LIMIT) + area(1) + generic(1);
    let _map: HashMap<i32, i32> = HashMap::new();
}
