use anchor_lang::prelude::*;

#[error_code]
pub enum ZuviError {
    #[msg("平台未初始化")]
    PlatformNotInitialized,
    
    #[msg("無效費用金額")]
    InvalidFeeAmount,
    
    #[msg("無效憑證")]
    InvalidAttestation,
    
    #[msg("房源狀態錯誤")]
    InvalidListingStatus,
    
    #[msg("非房源擁有者")]
    NotPropertyOwner,
    
    #[msg("申請狀態錯誤")]
    InvalidApplicationStatus,
    
    #[msg("合約狀態錯誤")]
    InvalidContractStatus,
    
    #[msg("非合約參與方")]
    NotContractParty,
    
    #[msg("無效付款日")]
    InvalidPaymentDay,
    
    #[msg("開始日期須為未來")]
    ContractStartDateMustBeFuture,
    
    #[msg("結束日期須晚於開始")]
    ContractEndDateMustBeAfterStart,
    
    #[msg("押金須大於零")]
    DepositMustBeGreaterThanZero,
    
    #[msg("月租須大於零")]
    RentMustBeGreaterThanZero,
    
    #[msg("合約未開始")]
    ContractNotStarted,
    
    #[msg("合約已結束")]
    ContractEnded,
    
    #[msg("押金已退還")]
    DepositAlreadyRefunded,
    
    #[msg("無權限")]
    Unauthorized,
    
    #[msg("餘額不足")]
    InsufficientBalance,
    
    #[msg("無效提取金額")]
    InvalidWithdrawAmount,
    
    #[msg("字串過長")]
    StringTooLong,
    
    #[msg("爭議狀態錯誤")]
    InvalidDisputeStatus,
    
    #[msg("無效還價")]
    InvalidCounterOffer,
    
    #[msg("協商次數過多")]
    TooManyCounters,
    
    #[msg("須接受申請人提案")]
    MustAcceptApplicantOffer,
}