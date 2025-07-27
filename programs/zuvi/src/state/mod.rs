pub mod application;
pub mod config;
pub mod dispute;
pub mod escrow;
pub mod lease;
pub mod listing;

pub use application::*;
pub use config::*;
pub use dispute::*;
pub use escrow::*;
pub use lease::*;
pub use listing::*;

// 狀態常數定義
pub const LISTING_STATUS_AVAILABLE: u8 = 0;
pub const LISTING_STATUS_RENTED: u8 = 1;
pub const LISTING_STATUS_INACTIVE: u8 = 2;

pub const APPLICATION_STATUS_PENDING: u8 = 0;
pub const APPLICATION_STATUS_APPROVED: u8 = 1;
pub const APPLICATION_STATUS_REJECTED: u8 = 2;
pub const APPLICATION_STATUS_EXPIRED: u8 = 3;

pub const LEASE_STATUS_ACTIVE: u8 = 0;
pub const LEASE_STATUS_COMPLETED: u8 = 1;
pub const LEASE_STATUS_TERMINATED: u8 = 2;

pub const ESCROW_STATUS_HOLDING: u8 = 0;
pub const ESCROW_STATUS_SETTLING: u8 = 1;
pub const ESCROW_STATUS_SETTLED: u8 = 2;

pub const DISPUTE_STATUS_PENDING: u8 = 0;
pub const DISPUTE_STATUS_RESOLVED: u8 = 1;

// 終止原因
pub const TERMINATION_MUTUAL: u8 = 0;
pub const TERMINATION_LANDLORD_BREACH: u8 = 1;
pub const TERMINATION_TENANT_BREACH: u8 = 2;
pub const TERMINATION_OVERDUE_EXCEED: u8 = 3;

// 爭議原因
pub const DISPUTE_DEPOSIT: u8 = 0;
pub const DISPUTE_DAMAGE: u8 = 1;
pub const DISPUTE_OTHER: u8 = 2;

// 系統限制
pub const MAX_FEE_RATE: u16 = 1000; // 10%
pub const MAX_GRACE_DAYS: u8 = 7;
pub const MAX_PAYMENT_DAY: u8 = 28;
pub const MAX_OVERDUE_COUNT: u8 = 3;
pub const MAX_FUTURE_LEASE_DAYS: i64 = 30 * 86400; // 30 days in seconds