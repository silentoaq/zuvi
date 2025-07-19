use anchor_lang::prelude::*;

/// 平台配置賬戶
#[account]
pub struct Platform {
    /// 平台管理員
    pub authority: Pubkey,
    /// 費用接收者
    pub fee_receiver: Pubkey,
    /// 發布房源費用 (0.01 USDC)
    pub listing_fee: u64,
    /// 簽約費用 (0.05 USDC，雙方各付一半)
    pub contract_fee: u64,
    /// 支付手續費 (0.005 USDC)
    pub payment_fee: u64,
    /// USDC mint 地址
    pub usdc_mint: Pubkey,
    /// 平台是否已初始化
    pub is_initialized: bool,
    /// bump seed
    pub bump: u8,
}

impl Platform {
    pub const SIZE: usize = 8 + // discriminator
        32 + // authority
        32 + // fee_receiver
        8 + // listing_fee
        8 + // contract_fee
        8 + // payment_fee
        32 + // usdc_mint
        1 + // is_initialized
        1 + // bump
        32; // padding
}

/// 房源狀態
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ListingStatus {
    /// 可用
    Available,
    /// 已出租
    Rented,
    /// 已下架
    Delisted,
}

/// 房源列表賬戶
#[account]
pub struct PropertyListing {
    /// 房產 ID (對應 twland 憑證)
    pub property_id: String,
    /// 房東地址
    pub owner: Pubkey,
    /// 房東的 attestation 查詢結果
    pub owner_attestation: String,
    /// 月租金 (USDC)
    pub monthly_rent: u64,
    /// 押金月數
    pub deposit_months: u8,
    /// 房產詳細資料 IPFS hash
    pub property_details_hash: String,
    /// 房源狀態
    pub status: ListingStatus,
    /// 當前租客 (如果已出租)
    pub current_tenant: Option<Pubkey>,
    /// 當前合約 (如果已出租)
    pub current_contract: Option<Pubkey>,
    /// 創建時間
    pub created_at: i64,
    /// bump seed
    pub bump: u8,
}

impl PropertyListing {
    pub const SIZE: usize = 8 + // discriminator
        64 + // property_id (max)
        32 + // owner
        128 + // owner_attestation (max)
        8 + // monthly_rent
        1 + // deposit_months
        64 + // property_details_hash (IPFS)
        1 + // status
        33 + // current_tenant (Option)
        33 + // current_contract (Option)
        8 + // created_at
        1 + // bump
        64; // padding
}

/// 申請狀態
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ApplicationStatus {
    /// 待處理
    Pending,
    /// 已接受
    Accepted,
    /// 已拒絕
    Rejected,
    /// 已取消
    Cancelled,
}

/// 租賃申請賬戶
#[account]
pub struct RentalApplication {
    /// 對應的房源
    pub listing: Pubkey,
    /// 申請人地址
    pub applicant: Pubkey,
    /// 申請人的 attestation 查詢結果
    pub applicant_attestation: String,
    /// 提議的條款 (JSON string)
    pub proposed_terms: String,
    /// 申請狀態
    pub status: ApplicationStatus,
    /// 創建時間
    pub created_at: i64,
    /// 更新時間
    pub updated_at: i64,
    /// bump seed
    pub bump: u8,
}

impl RentalApplication {
    pub const SIZE: usize = 8 + // discriminator
        32 + // listing
        32 + // applicant
        128 + // applicant_attestation (max)
        256 + // proposed_terms (max)
        1 + // status
        8 + // created_at
        8 + // updated_at
        1 + // bump
        32; // padding
}

/// 合約狀態
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ContractStatus {
    /// 待簽署
    PendingSignature,
    /// 生效中
    Active,
    /// 已終止
    Terminated,
    /// 已完成
    Completed,
}

/// 租賃合約賬戶
#[account]
pub struct RentalContract {
    /// 對應的房源
    pub listing: Pubkey,
    /// 房東地址
    pub landlord: Pubkey,
    /// 租客地址
    pub tenant: Pubkey,
    /// 月租金
    pub monthly_rent: u64,
    /// 押金金額
    pub deposit_amount: u64,
    /// 租約開始日期
    pub start_date: i64,
    /// 租約結束日期
    pub end_date: i64,
    /// 每月付款日 (1-28)
    pub payment_day: u8,
    /// 合約文件 IPFS hash
    pub contract_hash: String,
    /// 託管賬戶 (PDA)
    pub escrow_account: Pubkey,
    /// 合約狀態
    pub status: ContractStatus,
    /// 已支付月數
    pub paid_months: u16,
    /// 創建時間
    pub created_at: i64,
    /// bump seed
    pub bump: u8,
}

impl RentalContract {
    pub const SIZE: usize = 8 + // discriminator
        32 + // listing
        32 + // landlord
        32 + // tenant
        8 + // monthly_rent
        8 + // deposit_amount
        8 + // start_date
        8 + // end_date
        1 + // payment_day
        64 + // contract_hash (IPFS)
        32 + // escrow_account
        1 + // status
        2 + // paid_months
        8 + // created_at
        1 + // bump
        32; // padding
}

/// 支付類型
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PaymentType {
    /// 押金
    Deposit,
    /// 首月租金
    FirstMonth,
    /// 月租金
    MonthlyRent,
    /// 退還押金
    DepositRefund,
}

/// 支付記錄賬戶
#[account]
pub struct PaymentRecord {
    /// 對應的合約
    pub contract: Pubkey,
    /// 支付類型
    pub payment_type: PaymentType,
    /// 金額
    pub amount: u64,
    /// 支付者
    pub payer: Pubkey,
    /// 接收者
    pub receiver: Pubkey,
    /// 支付月份 (如果是月租)
    pub payment_month: Option<String>,
    /// 支付時間
    pub paid_at: i64,
    /// 交易簽名
    pub transaction_signature: String,
    /// bump seed
    pub bump: u8,
}

impl PaymentRecord {
    pub const SIZE: usize = 8 + // discriminator
        32 + // contract
        1 + // payment_type
        8 + // amount
        32 + // payer
        32 + // receiver
        20 + // payment_month (Option<String>)
        8 + // paid_at
        88 + // transaction_signature
        1 + // bump
        32; // padding
}

/// 託管賬戶資訊
#[account]
pub struct EscrowAccount {
    /// 對應的合約
    pub contract: Pubkey,
    /// 押金金額
    pub deposit_amount: u64,
    /// 是否已退還押金
    pub deposit_refunded: bool,
    /// bump seed
    pub bump: u8,
}

impl EscrowAccount {
    pub const SIZE: usize = 8 + // discriminator
        32 + // contract
        8 + // deposit_amount
        1 + // deposit_refunded
        1 + // bump
        16; // padding
}

#[event]
pub struct PropertyListed {
    pub listing: Pubkey,
    pub owner: Pubkey,
    pub property_id: String,
    pub monthly_rent: u64,
    pub timestamp: i64,
}

#[event]
pub struct ContractSigned {
    pub contract: Pubkey,
    pub landlord: Pubkey,
    pub tenant: Pubkey,
    pub total_payment: u64,
    pub timestamp: i64,
}

#[event]
pub struct RentPaid {
    pub contract: Pubkey,
    pub tenant: Pubkey,
    pub amount: u64,
    pub payment_month: String,
    pub timestamp: i64,
}