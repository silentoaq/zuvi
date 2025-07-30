use anchor_lang::prelude::*;

/// 系統配置帳戶
#[account]
pub struct Config {
    /// API 簽名者公鑰
    pub api_signer: Pubkey,
    /// 仲裁者公鑰
    pub arbitrator: Pubkey,
    /// 平台費用接收者
    pub fee_receiver: Pubkey,
    /// USDC SPL Token Mint
    pub usdc_mint: Pubkey,
    /// 費率 (basis points, 100 = 1%)
    pub fee_rate: u16,
    /// 是否已初始化
    pub initialized: bool,
}

/// 房源列表帳戶
#[account]
pub struct Listing {
    /// 房東公鑰
    pub owner: Pubkey,
    /// 產權憑證公鑰
    pub property_attest: Pubkey,
    /// 房屋地址（來自憑證揭露）
    pub address: [u8; 64],
    /// 建物面積（來自憑證揭露）
    pub building_area: u32,
    /// 月租金 (USDC lamports)
    pub rent: u64,
    /// 押金金額 (USDC lamports)
    pub deposit: u64,
    /// IPFS Hash 存放房源詳情
    pub metadata_uri: [u8; 64],
    /// 狀態: 0=可用, 1=已租, 2=下架
    pub status: u8,
    /// 當前承租人（如果有）
    pub current_tenant: Option<Pubkey>,
    /// 創建時間戳
    pub created_at: i64,
}

/// 租賃申請帳戶
#[account]
pub struct Application {
    /// 申請的房源
    pub listing: Pubkey,
    /// 申請人公鑰
    pub applicant: Pubkey,
    /// 承租人憑證公鑰
    pub tenant_attest: Pubkey,
    /// IPFS Hash 存放申請資料
    pub message_uri: [u8; 64],
    /// 狀態: 0=待審, 1=核准, 2=拒絕
    pub status: u8,
    /// 創建時間戳
    pub created_at: i64,
}

/// 租約帳戶
#[account]
pub struct Lease {
    /// 關聯的房源
    pub listing: Pubkey,
    /// 房東公鑰
    pub landlord: Pubkey,
    /// 承租人公鑰
    pub tenant: Pubkey,
    /// 承租人憑證
    pub tenant_attest: Pubkey,
    
    /// 月租金 (USDC lamports)
    pub rent: u64,
    /// 押金金額 (USDC lamports)
    pub deposit: u64,
    /// 開始日期 (Unix timestamp)
    pub start_date: i64,
    /// 結束日期 (Unix timestamp)
    pub end_date: i64,
    
    /// 每月繳費日 (1-28)
    pub payment_day: u8,
    /// 已付月數
    pub paid_months: u32,
    /// 上次付款時間
    pub last_payment: i64,
    
    /// IPFS Hash 存放合約內容
    pub contract_uri: [u8; 64],
    /// 狀態: 0=生效中, 1=已完成, 2=已終止
    pub status: u8,
    /// 房東是否已簽署
    pub landlord_signed: bool,
    /// 承租人是否已簽署
    pub tenant_signed: bool,
}

/// 押金託管帳戶
#[account]
pub struct Escrow {
    /// 關聯的租約
    pub lease: Pubkey,
    /// 押金總額 (USDC lamports)
    pub amount: u64,
    /// 狀態: 0=持有中, 1=釋放中, 2=已釋放
    pub status: u8,
    /// 分配給房東的金額
    pub release_to_landlord: u64,
    /// 分配給承租人的金額
    pub release_to_tenant: u64,
    /// 房東是否確認結算
    pub landlord_signed: bool,
    /// 承租人是否確認結算
    pub tenant_signed: bool,
    /// 是否有爭議
    pub has_dispute: bool,
}

/// 爭議帳戶
#[account]
pub struct Dispute {
    /// 關聯的租約
    pub lease: Pubkey,
    /// 發起人公鑰
    pub initiator: Pubkey,
    /// 爭議原因: 0=押金爭議, 1=其他
    pub reason: u8,
    /// 狀態: 0=進行中, 1=已解決
    pub status: u8,
    /// 創建時間戳
    pub created_at: i64,
}