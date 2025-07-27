use anchor_lang::prelude::*;

#[account]
pub struct Listing {
    // 不可變資料（來自憑證揭露）
    pub owner: Pubkey,              // 房東錢包
    pub property_attest: Pubkey,    // 產權認證 PDA
    pub address: String,            // 房屋地址
    pub building_area: u32,         // 建物面積
    pub use_type: String,           // 使用類型(必須="住宅")
    
    // 可變資料
    pub rent: u64,                  // 月租金(USDC)
    pub deposit: u64,               // 押金(USDC)
    pub status: u8,                 // 0:available, 1:rented, 2:inactive
    pub current_lease: Option<Pubkey>, // 當前租約
    pub total_leases: u32,          // 歷史租約數
    pub metadata_uri: String,       // IPFS Hash
    pub grace_days: u8,             // 租金緩衝天數(0-7)
    
    pub created_at: i64,
    pub updated_at: i64,
}

impl Listing {
    pub const LEN: usize = 8 + // discriminator
        32 +    // owner
        32 +    // property_attest
        4 + 64 + // address (String: 4 bytes len + content)
        4 +     // building_area
        4 + 16 + // use_type (String: 4 bytes len + content)
        8 +     // rent
        8 +     // deposit
        1 +     // status
        1 + 32 + // current_lease (Option<Pubkey>: 1 byte + 32 bytes)
        4 +     // total_leases
        4 + 64 + // metadata_uri (String: 4 bytes len + content)
        1 +     // grace_days
        8 +     // created_at
        8;      // updated_at
        
    pub const SEED: &'static [u8] = b"list";
}