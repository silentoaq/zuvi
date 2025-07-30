/// PDA 種子常數
pub const CONFIG_SEED: &[u8] = b"config";
pub const LISTING_SEED: &[u8] = b"list";
pub const APPLICATION_SEED: &[u8] = b"apply";
pub const LEASE_SEED: &[u8] = b"lease";
pub const ESCROW_SEED: &[u8] = b"escrow";
pub const DISPUTE_SEED: &[u8] = b"dispute";

/// 帳戶大小常數
pub const CONFIG_SIZE: usize = 8 + 32 + 32 + 32 + 32 + 2 + 1; // ~139 bytes
pub const LISTING_SIZE: usize = 8 + 32 + 32 + 64 + 4 + 8 + 8 + 64 + 1 + 1 + 32 + 8; // ~285 bytes
pub const APPLICATION_SIZE: usize = 8 + 32 + 32 + 32 + 64 + 1 + 8; // ~225 bytes
pub const LEASE_SIZE: usize = 8 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 4 + 8 + 64 + 1 + 1 + 1; // ~293 bytes
pub const ESCROW_SIZE: usize = 8 + 32 + 8 + 1 + 8 + 8 + 1 + 1 + 1; // ~115 bytes
pub const DISPUTE_SIZE: usize = 8 + 32 + 32 + 1 + 1 + 8; // ~75 bytes

/// 狀態常數
pub const LISTING_STATUS_AVAILABLE: u8 = 0;
pub const LISTING_STATUS_RENTED: u8 = 1;
pub const LISTING_STATUS_INACTIVE: u8 = 2;

pub const APPLICATION_STATUS_PENDING: u8 = 0;
pub const APPLICATION_STATUS_APPROVED: u8 = 1;
pub const APPLICATION_STATUS_REJECTED: u8 = 2;

pub const LEASE_STATUS_ACTIVE: u8 = 0;
pub const LEASE_STATUS_COMPLETED: u8 = 1;
pub const LEASE_STATUS_TERMINATED: u8 = 2;

pub const ESCROW_STATUS_HOLDING: u8 = 0;
pub const ESCROW_STATUS_RELEASING: u8 = 1;
pub const ESCROW_STATUS_RELEASED: u8 = 2;

pub const DISPUTE_STATUS_OPEN: u8 = 0;
pub const DISPUTE_STATUS_RESOLVED: u8 = 1;

pub const DISPUTE_REASON_DEPOSIT: u8 = 0;
pub const DISPUTE_REASON_OTHER: u8 = 1;

/// 業務邏輯常數
pub const MAX_FEE_RATE: u16 = 1000; // 10% = 1000 basis points
pub const MIN_DEPOSIT_MONTHS: u8 = 1; // 最少 1 個月押金
pub const MAX_DEPOSIT_MONTHS: u8 = 3; // 最多 3 個月押金
pub const MAX_ADVANCE_DAYS: i64 = 30; // 最多提前 30 天
pub const MIN_PAYMENT_DAY: u8 = 1;
pub const MAX_PAYMENT_DAY: u8 = 28;

/// 時間常數
pub const SECONDS_PER_DAY: i64 = 86400;

/// IPFS Hash 長度 (CIDv0)
pub const IPFS_HASH_LENGTH: usize = 64;