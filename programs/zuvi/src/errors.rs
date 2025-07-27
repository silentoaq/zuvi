use anchor_lang::prelude::*;

#[error_code]
pub enum ZuviError {
    #[msg("E001: 系統尚未初始化")]
    NotInitialized,
    
    #[msg("E002: 無權限執行此操作")]
    Unauthorized,
    
    #[msg("E003: 房源已出租")]
    ListingAlreadyRented,
    
    #[msg("E004: 申請不存在或狀態不正確")]
    InvalidApplication,
    
    #[msg("E005: 租約未生效")]
    LeaseNotActive,
    
    #[msg("E006: 尚未簽署")]
    NotSigned,
    
    #[msg("E007: 已經簽署")]
    AlreadySigned,
    
    #[msg("E008: 爭議進行中，無法執行")]
    DisputeInProgress,
    
    #[msg("E009: 無效的參數")]
    InvalidParameter,
    
    #[msg("E010: 需要 API 簽名")]
    ApiSignatureRequired,
    
    #[msg("E011: 房源已下架")]
    ListingInactive,
    
    #[msg("E012: 重複申請")]
    DuplicateApplication,
    
    #[msg("E013: 租約已存在")]
    LeaseAlreadyExists,
    
    #[msg("E014: 支付日尚未到期")]
    PaymentNotDue,
    
    #[msg("E015: 租約已結束")]
    LeaseEnded,
    
    #[msg("E016: 金額不匹配")]
    AmountMismatch,
    
    #[msg("E017: 爭議已解決")]
    DisputeAlreadyResolved,
    
    #[msg("E018: 非仲裁者")]
    NotArbitrator,
    
    #[msg("E019: 押金已釋放")]
    DepositAlreadyReleased,
    
    #[msg("E020: 無效的日期")]
    InvalidDate,
    
    #[msg("E021: 無效的費率")]
    InvalidFeeRate,
    
    #[msg("E022: 無效的押金金額")]
    InvalidDepositAmount,
    
    #[msg("E023: 無效的支付日")]
    InvalidPaymentDay,
    
    #[msg("E024: 無效的爭議原因")]
    InvalidDisputeReason,
    
    #[msg("E025: 無法對自己的房源申請")]
    CannotApplyOwnListing,
}