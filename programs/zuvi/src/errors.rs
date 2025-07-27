use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("無效的憑證")]
    InvalidCredential,
    
    #[msg("憑證已過期")]
    CredentialExpired,
    
    #[msg("非住宅用途")]
    NotResidentialUse,
    
    #[msg("房源已出租")]
    ListingAlreadyRented,
    
    #[msg("押金不足")]
    InsufficientDeposit,
    
    #[msg("租金逾期")]
    RentOverdue,
    
    #[msg("無權限操作")]
    Unauthorized,
    
    #[msg("申請已存在")]
    ApplicationAlreadyExists,
    
    #[msg("房源已下架")]
    ListingInactive,
    
    #[msg("程式未初始化")]
    NotInitialized,
    
    #[msg("爭議處理中")]
    DisputeInProgress,
    
    #[msg("需要 API 簽名")]
    ApiSignatureRequired,
    
    #[msg("結算待確認")]
    SettlementPending,
    
    #[msg("無效的費率")]
    InvalidFeeRate,
    
    #[msg("押金超出範圍")]
    DepositOutOfRange,
    
    #[msg("開始日期無效")]
    InvalidStartDate,
    
    #[msg("超過逾期上限")]
    ExceedOverdueLimit,
    
    #[msg("已初始化")]
    AlreadyInitialized,
    
    #[msg("有租約不可下架")]
    CannotDeactivateWithLease,
    
    #[msg("無效的繳費日")]
    InvalidPaymentDay,
    
    #[msg("支付已存在")]
    PaymentAlreadyExists,
    
    #[msg("支付不存在")]
    PaymentNotFound,
    
    #[msg("無效的寬限天數")]
    InvalidGraceDays,
    
    #[msg("使用類型必須為住宅")]
    MustBeResidential,
    
    #[msg("申請不存在")]
    ApplicationNotFound,
    
    #[msg("申請已過期")]
    ApplicationExpired,
    
    #[msg("租約不存在")]
    LeaseNotFound,
    
    #[msg("租約已終止")]
    LeaseAlreadyTerminated,
    
    #[msg("押金已結算")]
    EscrowAlreadySettled,
    
    #[msg("爭議不存在")]
    DisputeNotFound,
    
    #[msg("爭議已解決")]
    DisputeAlreadyResolved,
    
    #[msg("扣款金額超過押金")]
    DeductionExceedsDeposit,
    
    #[msg("無效的終止原因")]
    InvalidTerminationReason,
    
    #[msg("無效的爭議原因")]
    InvalidDisputeReason,
    
    #[msg("結算請求不存在")]
    SettleRequestNotFound,
    
    #[msg("結算已確認")]
    SettleAlreadyConfirmed,
    
    #[msg("分配金額不符")]
    InvalidDistribution,
}