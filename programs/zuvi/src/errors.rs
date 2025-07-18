use anchor_lang::prelude::*;

#[error_code]
pub enum ZuviError {
    #[msg("平台已經初始化")]
    PlatformAlreadyInitialized,

    #[msg("平台尚未初始化")]
    PlatformNotInitialized,

    #[msg("無效的費用金額")]
    InvalidFeeAmount,

    #[msg("無效的房產 ID")]
    InvalidPropertyId,

    #[msg("無效的 attestation")]
    InvalidAttestation,

    #[msg("房產已經上架")]
    PropertyAlreadyListed,

    #[msg("房源不存在")]
    ListingNotFound,

    #[msg("房源狀態不正確")]
    InvalidListingStatus,

    #[msg("您不是房源的擁有者")]
    NotPropertyOwner,

    #[msg("申請不存在")]
    ApplicationNotFound,

    #[msg("申請狀態不正確")]
    InvalidApplicationStatus,

    #[msg("您不是申請人")]
    NotApplicant,

    #[msg("合約不存在")]
    ContractNotFound,

    #[msg("合約狀態不正確")]
    InvalidContractStatus,

    #[msg("您不是合約的參與方")]
    NotContractParty,

    #[msg("無效的付款日期")]
    InvalidPaymentDay,

    #[msg("無效的租約期限")]
    InvalidContractDuration,

    #[msg("租約開始日期必須在未來")]
    ContractStartDateMustBeFuture,

    #[msg("租約結束日期必須在開始日期之後")]
    ContractEndDateMustBeAfterStart,

    #[msg("押金必須大於零")]
    DepositMustBeGreaterThanZero,

    #[msg("月租金必須大於零")]
    RentMustBeGreaterThanZero,

    #[msg("支付金額不正確")]
    IncorrectPaymentAmount,

    #[msg("本月租金已支付")]
    RentAlreadyPaidForMonth,

    #[msg("合約尚未開始")]
    ContractNotStarted,

    #[msg("合約已經結束")]
    ContractEnded,

    #[msg("押金已經退還")]
    DepositAlreadyRefunded,

    #[msg("尚有未支付的租金")]
    UnpaidRentExists,

    #[msg("無權限執行此操作")]
    Unauthorized,

    #[msg("賬戶餘額不足")]
    InsufficientBalance,

    #[msg("無效的 USDC mint")]
    InvalidUsdcMint,

    #[msg("字串長度超過限制")]
    StringTooLong,

    #[msg("無效的提款金額")]
    InvalidWithdrawAmount,
}